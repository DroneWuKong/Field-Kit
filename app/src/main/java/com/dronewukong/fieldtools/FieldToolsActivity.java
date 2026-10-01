package com.dronewukong.fieldtools;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.OutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public final class FieldToolsActivity extends Activity {
    private static final String URL = "https://appassets.androidplatform.net/assets/tools/tools_offline.html?mode=standalone&configPreview=1#configuration-deploy";
    private static final int PICK_FILE = 42, SAVE_FILE = 43;
    private WebView web;
    private ConfigLink link;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingName, pendingText;
    private String pendingMime;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(13, 20, 27));
        link = new ConfigLink(getApplicationContext());
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(13, 20, 27));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // WebChromeClient file picker only.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri.toString().startsWith(URL.split("\\?")[0])) return false;
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())))
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent picker = params.createIntent();
                    picker.setType("*/*");
                    startActivityForResult(picker, PICK_FILE);
                } catch (Exception e) { fileCallback = null; callback.onReceiveValue(null); }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(URL);
    }
    private void save(String name, String type, String content) {
        if (pendingText != null) return;
        pendingName = name; pendingMime = type; pendingText = content;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.setType(type);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try { startActivityForResult(intent, SAVE_FILE); }
        catch (Exception e) { pendingText = null; Toast.makeText(this, "Document picker unavailable", Toast.LENGTH_LONG).show(); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE) {
            if (fileCallback != null) fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        } else if (request == SAVE_FILE) {
            String content = pendingText; pendingText = null; pendingName = null; pendingMime = null;
            if (result == RESULT_OK && data != null && data.getData() != null && content != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new Exception("No output stream");
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
                } catch (Exception e) { Toast.makeText(this, "Save failed: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
            }
        }
    }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() {
        link.destroy();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.removeJavascriptInterface("Android"); web.destroy(); super.onDestroy();
    }

    private final class Bridge {
        @JavascriptInterface public String getAppVersion() { return "0.4.0-preview"; }
        @JavascriptInterface public String listConfigPorts() { return link.list(); }
        @JavascriptInterface public String openConfigUsb(String id, int baud) { return link.openUsb(id, baud); }
        @JavascriptInterface public String openConfigUdp(int port) { return link.openUdp(port); }
        @JavascriptInterface public String configPortStatus() { return link.status(); }
        @JavascriptInterface public String readConfigBytes() { return link.read(); }
        @JavascriptInterface public String writeConfigBytes(String base64) { return link.write(base64); }
        @JavascriptInterface public boolean pinConfigPeer() { return link.pinPeer(); }
        @JavascriptInterface public void closeConfigPort() { link.close(); }
        @JavascriptInterface public boolean saveConfigRun(String id, String json) {
            if (id == null || !id.matches("[a-fA-F0-9-]{36}") || json == null || json.length() > 2000000) return false;
            File dir = new File(getFilesDir(), "configuration-runs");
            if (!dir.isDirectory() && !dir.mkdirs()) return false;
            File tmp = new File(dir, id + ".tmp"), dst = new File(dir, id + ".json");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(json.getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            } catch (Exception e) { tmp.delete(); return false; }
            if (!tmp.renameTo(dst)) { tmp.delete(); return false; }
            return true;
        }
        @JavascriptInterface public boolean copyText(String text) {
            if (text == null || text.length() > 250000) return false;
            runOnUiThread(() -> ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE))
                .setPrimaryClip(ClipData.newPlainText("Field Kit", text)));
            return true;
        }
        @JavascriptInterface public void saveReport(String name, String html) { saveText(name, "text/html", html); }
        @JavascriptInterface public void saveText(String name, String mime, String text) {
            if (name == null || !name.matches("[A-Za-z0-9_.-]{1,100}") || text == null || text.length() > 2000000) return;
            if (!"text/plain".equals(mime) && !"text/html".equals(mime)) return;
            runOnUiThread(() -> save(name, mime, text));
        }
        @JavascriptInterface public String getCurrentPhoneLocation() {
            JSONObject row = new JSONObject();
            try {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                    return "{\"error\":\"location_permission_required\"}";
                LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
                Location gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                Location net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                Location l = gps != null && (net == null || gps.getTime() >= net.getTime()) ? gps : net;
                if (l == null) return "{\"error\":\"no_fix\"}";
                row.put("lat", l.getLatitude()); row.put("lon", l.getLongitude());
                row.put("accuracy", l.getAccuracy()); row.put("timestamp", l.getTime());
            } catch (Exception e) { return "{\"error\":\"location_unavailable\"}"; }
            return row.toString();
        }
        @JavascriptInterface public String requestFreshPhoneLocation() { return getCurrentPhoneLocation(); }
        @JavascriptInterface public String requestLocationPermission() {
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 99));
            return "requested";
        }
        @JavascriptInterface public String getDiagnosticPorts() { return link.list(); }
    }
}
