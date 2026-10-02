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
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Looper;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class FieldToolsActivity extends Activity {
    private static final String URL = "https://appassets.androidplatform.net/assets/tools/tools_offline.html?mode=standalone#home";
    private static final int PICK_FILE = 42, SAVE_FILE = 43;
    private WebView web;
    private ConfigLink link;
    private DiagnosticSession diagnostics;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingName, pendingText;
    private String pendingMime;
    private volatile Location latestPhoneLocation;
    private volatile String phoneLocationState = "not_requested";
    private LocationListener phoneLocationListener;
    private final ExecutorService metadataExecutor = Executors.newSingleThreadExecutor();

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(13, 20, 27));
        link = new ConfigLink(getApplicationContext());
        diagnostics = new DiagnosticSession(link);
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
        diagnostics.stop();
        cancelPhoneLocationRequest();
        metadataExecutor.shutdownNow();
        link.destroy();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.removeJavascriptInterface("Android"); web.destroy(); super.onDestroy();
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("Boolean(window.fieldKitBack && window.fieldKitBack())", value -> {
            if (!"true".equals(value)) FieldToolsActivity.super.onBackPressed();
        });
    }

    private void cancelPhoneLocationRequest() {
        if (phoneLocationListener == null) return;
        try { ((LocationManager) getSystemService(LOCATION_SERVICE)).removeUpdates(phoneLocationListener); }
        catch (Exception ignored) { }
        phoneLocationListener = null;
    }

    private Location bestLastLocation() {
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        Location gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        Location net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
        return gps != null && (net == null || gps.getTime() >= net.getTime()) ? gps : net;
    }

    private String locationJson(Location location, boolean rejectStale) {
        if (location == null) return "{\"error\":\"no_fix\"}";
        long ageMs = Math.max(0, System.currentTimeMillis() - location.getTime());
        if (rejectStale && ageMs > 60000) return "{\"error\":\"stale_fix\"}";
        JSONObject row = new JSONObject();
        try {
            row.put("lat", location.getLatitude()); row.put("lon", location.getLongitude());
            row.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
            row.put("ageSeconds", ageMs / 1000.0); row.put("observedAt", location.getTime());
            row.put("provider", location.getProvider() == null ? "Android" : location.getProvider());
            row.put("mock", location.isFromMockProvider());
        } catch (Exception ignored) { }
        return row.toString();
    }

    private final class Bridge {
        @JavascriptInterface public String getAppVersion() { return "0.4.2"; }
        @JavascriptInterface public String listConfigPorts() { return link.list(); }
        @JavascriptInterface public String openConfigUsb(String id, int baud) { diagnostics.reset(); return link.openUsb(id, baud); }
        @JavascriptInterface public String openConfigUdp(int port) { diagnostics.reset(); return link.openUdp(port); }
        @JavascriptInterface public String configPortStatus() { return link.status(); }
        @JavascriptInterface public String readConfigBytes() { return link.read(); }
        @JavascriptInterface public String writeConfigBytes(String base64) { return link.write(base64); }
        @JavascriptInterface public boolean pinConfigPeer() { return link.pinPeer(); }
        @JavascriptInterface public void closeConfigPort() { diagnostics.reset(); link.close(); }
        @JavascriptInterface public void fetchArduMetadata(String requestId, String vehicle, String keysJson) {
            if (requestId == null || !requestId.matches("[a-fA-F0-9-]{36}")) return;
            if (vehicle == null || !vehicle.matches("ArduCopter|ArduPlane|Rover|ArduSub")) {
                deliverArduMetadata(requestId, null, "Unsupported ArduPilot vehicle type"); return;
            }
            final Set<String> wanted = new HashSet<>();
            try {
                JSONArray keys = new JSONArray(keysJson);
                if (keys.length() < 1 || keys.length() > 10000) throw new Exception("Invalid parameter list");
                for (int i = 0; i < keys.length(); i++) {
                    String key = keys.getString(i);
                    if (!key.matches("[A-Z][A-Z0-9_]{0,15}")) throw new Exception("Invalid parameter name");
                    wanted.add(key);
                }
            } catch (Exception e) { deliverArduMetadata(requestId, null, "Invalid parameter list"); return; }
            metadataExecutor.execute(() -> {
                HttpURLConnection connection = null;
                try {
                    String sourceUrl = "https://autotest.ardupilot.org/Parameters/" + vehicle + "/apm.pdef.json";
                    connection = (HttpURLConnection) new URL(sourceUrl).openConnection();
                    connection.setConnectTimeout(10000); connection.setReadTimeout(25000);
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty("User-Agent", "Prismo-Field-Kit/0.4.2");
                    if (connection.getResponseCode() != 200) throw new Exception("Official metadata server returned " + connection.getResponseCode());
                    int declared = connection.getContentLength();
                    if (declared > 12000000) throw new Exception("Metadata response is too large");
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream(Math.max(32768, declared));
                    try (InputStream input = connection.getInputStream()) {
                        byte[] buffer = new byte[16384]; int read, total = 0;
                        while ((read = input.read(buffer)) >= 0) { total += read; if (total > 12000000) throw new Exception("Metadata response is too large"); bytes.write(buffer, 0, read); }
                    }
                    JSONObject root = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
                    JSONObject selected = new JSONObject();
                    Iterator<String> groups = root.keys();
                    while (groups.hasNext()) {
                        String groupName = groups.next(); if ("json".equals(groupName)) continue;
                        JSONObject group = root.optJSONObject(groupName); if (group == null) continue;
                        Iterator<String> names = group.keys();
                        while (names.hasNext()) { String name = names.next(); if (wanted.contains(name)) selected.put(name, group.get(name)); }
                    }
                    JSONObject result = new JSONObject();
                    result.put("schema", "prismo.ardupilot-parameter-metadata.v1");
                    result.put("vehicle", vehicle); result.put("source", sourceUrl);
                    result.put("fetchedAt", System.currentTimeMillis()); result.put("parameters", selected);
                    String json = result.toString(); if (json.length() > 6000000) throw new Exception("Filtered metadata is too large");
                    deliverArduMetadata(requestId, json, null);
                } catch (Exception e) { deliverArduMetadata(requestId, null, e.getMessage() == null ? "Metadata download failed" : e.getMessage()); }
                finally { if (connection != null) connection.disconnect(); }
            });
        }
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
            try {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                    return "{\"error\":\"location_permission_not_granted\"}";
                if ("pending".equals(phoneLocationState)) return "{\"error\":\"pending\"}";
                if ("not_requested".equals(phoneLocationState)) return "{\"error\":\"not_requested\"}";
                if (latestPhoneLocation == null) return "{\"error\":\"no_fix\"}";
            } catch (Exception e) { return "{\"error\":\"location_unavailable\"}"; }
            return locationJson(latestPhoneLocation, false);
        }
        @JavascriptInterface public String getGpsLocation() {
            try {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                    return "{\"error\":\"location_permission_not_granted\"}";
                return locationJson(bestLastLocation(), true);
            } catch (Exception e) { return "{\"error\":\"location_unavailable\"}"; }
        }
        @JavascriptInterface public String requestFreshPhoneLocation() {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                return "{\"error\":\"location_permission_not_granted\"}";
            phoneLocationState = "pending"; latestPhoneLocation = null;
            runOnUiThread(() -> {
                cancelPhoneLocationRequest();
                LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
                phoneLocationListener = location -> {
                    latestPhoneLocation = location; phoneLocationState = "ready";
                    cancelPhoneLocationRequest();
                };
                try {
                    String provider = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                        ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
                    lm.requestSingleUpdate(provider, phoneLocationListener, Looper.getMainLooper());
                } catch (Exception e) { phoneLocationState = "unavailable"; cancelPhoneLocationRequest(); }
            });
            return "{\"error\":\"pending\"}";
        }
        @JavascriptInterface public String requestLocationPermission() {
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 99));
            return "requested";
        }
        @JavascriptInterface public String getDiagnosticPorts() { return link.list(); }
        @JavascriptInterface public String startDiagnostics(String options) { link.close(); return diagnostics.start(options); }
        @JavascriptInterface public void stopDiagnostics() { diagnostics.stop(); }
        @JavascriptInterface public String getDiagnostics() { return diagnostics.snapshot(); }
        @JavascriptInterface public void probeVideo(String host, int port) { diagnostics.probeVideo(host, port); }
    }

    private void deliverArduMetadata(String requestId, String json, String error) {
        runOnUiThread(() -> {
            if (web == null) return;
            String call = "window.FieldKitArduMetadata&&FieldKitArduMetadata.receive(" + JSONObject.quote(requestId) + ","
                + (json == null ? "null" : JSONObject.quote(json)) + "," + (error == null ? "null" : JSONObject.quote(error)) + ")";
            web.evaluateJavascript(call, null);
        });
    }
}
