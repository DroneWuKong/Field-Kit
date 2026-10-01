package com.dronewukong.fieldtools;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;

/** One physical writer. The WebView uses the same byte stream as software peers in tests. */
final class ConfigLink {
    private final Context context;
    private final UsbManager manager;
    private final String permissionAction;
    private UsbSerialPort port;
    private DatagramSocket socket;
    private InetAddress peer;
    private int peerPort;
    private boolean peerLocked;
    private String selected = "";
    private String state = "closed";
    private String error = "";
    private int baud = 115200;
    private int generation;
    private Candidate waiting;
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent intent) {
            if (permissionAction.equals(intent.getAction())) {
                if (waiting == null || intent.getIntExtra("generation", -1) != generation) return;
                Candidate candidate = waiting; waiting = null;
                if (!manager.hasPermission(candidate.driver.getDevice())) { state = "error"; error = "USB permission denied"; return; }
                try { open(candidate); } catch (Exception e) { close(); state = "error"; error = e.getMessage(); }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(intent.getAction())) {
                UsbDevice device = Build.VERSION.SDK_INT >= 33
                    ? intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice.class)
                    : intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (device != null && selected.startsWith(device.getDeviceName() + "#")) {
                    close(); state = "error"; error = "USB device disconnected";
                }
            }
        }
    };

    ConfigLink(Context context) {
        this.context = context;
        this.manager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        this.permissionAction = context.getPackageName() + ".CONFIG_USB_PERMISSION";
        IntentFilter filter = new IntentFilter(permissionAction);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else context.registerReceiver(receiver, filter);
    }

    private static final class Candidate {
        final UsbSerialDriver driver; final int index;
        Candidate(UsbSerialDriver d, int i) { driver = d; index = i; }
        String id() { return driver.getDevice().getDeviceName() + "#" + index; }
    }
    private Candidate find(String id) {
        for (UsbSerialDriver driver : UsbSerialProber.getDefaultProber().findAllDrivers(manager))
            for (int i = 0; i < driver.getPorts().size(); i++) {
                Candidate c = new Candidate(driver, i);
                if (c.id().equals(id)) return c;
            }
        return null;
    }
    synchronized String list() {
        JSONArray rows = new JSONArray();
        for (UsbSerialDriver driver : UsbSerialProber.getDefaultProber().findAllDrivers(manager))
            for (int i = 0; i < driver.getPorts().size(); i++) {
                Candidate c = new Candidate(driver, i); UsbDevice d = driver.getDevice();
                JSONObject row = new JSONObject();
                try {
                    row.put("id", c.id()); row.put("label", (d.getProductName() == null ? "USB serial" : d.getProductName()) + " · " + d.getVendorId() + ":" + d.getProductId() + " / port " + (i + 1));
                    row.put("hasPermission", manager.hasPermission(d));
                    if (manager.hasPermission(d)) {
                        try { row.put("serial", d.getSerialNumber()); } catch (Exception ignored) { }
                    }
                } catch (Exception ignored) { }
                rows.put(row);
            }
        return rows.toString();
    }
    synchronized String openUsb(String id, int baudRate) { return openUsb(id, baudRate, false); }
    synchronized String openUsb(String id, int baudRate, boolean dtr) {
        close();
        if (baudRate < 9600 || baudRate > 3000000) return fail("Invalid baud rate");
        Candidate c = find(id);
        if (c == null) return fail("USB port not found; refresh ports");
        selected = id; baud = baudRate; requestedDtr = dtr; generation++;
        if (!manager.hasPermission(c.driver.getDevice())) {
            waiting = c; state = "permission-pending";
            Intent request = new Intent(permissionAction).setPackage(context.getPackageName())
                .putExtra("generation", generation);
            PendingIntent intent = PendingIntent.getBroadcast(context, 0, request,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            manager.requestPermission(c.driver.getDevice(), intent);
            return status();
        }
        try { open(c, dtr); return status(); }
        catch (Exception e) { close(); return fail("USB open: " + e.getMessage()); }
    }
    private boolean requestedDtr;
    private void open(Candidate candidate) throws IOException { open(candidate, requestedDtr); }
    private void open(Candidate candidate, boolean dtr) throws IOException {
        UsbSerialPort next = candidate.driver.getPorts().get(candidate.index);
        android.hardware.usb.UsbDeviceConnection connection = manager.openDevice(candidate.driver.getDevice());
        if (connection == null) throw new IOException("Android could not open USB port");
        try {
            next.open(connection);
            next.setParameters(baud, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            if (dtr) next.setDTR(true);
            requestedDtr = dtr;
            port = next; state = "connected"; error = "";
        } catch (Exception e) { next.close(); connection.close(); throw new IOException("Serial port setup failed", e); }
    }
    synchronized String openUdp(int listenPort) {
        close();
        if (listenPort < 1024 || listenPort > 65535) return fail("Invalid UDP port");
        try {
            socket = new DatagramSocket(listenPort); socket.setSoTimeout(250);
            state = "connected"; selected = "udp:" + listenPort; return status();
        } catch (Exception e) { close(); return fail("UDP listen: " + e.getMessage()); }
    }
    private String fail(String reason) { state = "error"; error = reason; return status(); }
    synchronized String status() {
        JSONObject status = new JSONObject();
        try { status.put("state", state); status.put("id", selected); status.put("error", error); status.put("peer", peer == null ? "" : peer.getHostAddress() + ":" + peerPort); }
        catch (Exception ignored) { }
        return status.toString();
    }
    synchronized String read() {
        if (!"connected".equals(state)) return "";
        byte[] b = new byte[8192];
        try {
            int n;
            if (port != null) n = port.read(b, 250);
            else {
                DatagramPacket packet = new DatagramPacket(b, b.length);
                try { socket.receive(packet); } catch (SocketTimeoutException timeout) { return ""; }
                if (peerLocked && (!packet.getAddress().equals(peer) || packet.getPort() != peerPort)) return "";
                n = packet.getLength(); peer = packet.getAddress(); peerPort = packet.getPort();
            }
            return n > 0 ? Base64.encodeToString(b, 0, n, Base64.NO_WRAP) : "";
        } catch (Exception e) { close(); fail("Read: " + e.getMessage()); return ""; }
    }
    synchronized String write(String encoded) {
        if (!"connected".equals(state)) return fail("No connected device");
        try {
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > 8192) return fail("Write size must be 1–8192 bytes");
            if (port != null) port.write(bytes, 2000);
            else {
                if (peer == null) return fail("Waiting for a MAVLink peer on this UDP port");
                socket.send(new DatagramPacket(bytes, bytes.length, peer, peerPort));
            }
            return "ok";
        } catch (Exception e) { close(); return fail("Write: " + e.getMessage()); }
    }
    synchronized boolean pinPeer() {
        if (socket == null || peer == null) return false;
        peerLocked = true; return true;
    }
    synchronized void close() {
        generation++; waiting = null;
        try { if (port != null) port.close(); } catch (Exception ignored) { }
        if (socket != null) socket.close();
        port = null; socket = null; peer = null; peerPort = 0; peerLocked = false; requestedDtr = false; selected = ""; state = "closed"; error = "";
    }
    void destroy() { close(); context.unregisterReceiver(receiver); }
}
