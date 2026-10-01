package com.dronewukong.fieldtools;

import android.util.Base64;

import org.json.JSONObject;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/** Passive USB/UDP observation used by Connection Doctor. It never sends flight-controller commands. */
final class DiagnosticSession {
    private static final Map<Integer,Integer> MAV_CRC = new HashMap<>();
    static {
        int[][] values = {{0,50},{1,124},{2,137},{4,237},{24,24},{30,39},{33,104},{35,244},
            {65,118},{74,20},{109,185},{125,203},{129,46},{147,154},{253,83}};
        for (int[] value : values) MAV_CRC.put(value[0], value[1]);
    }

    private final ConfigLink link;
    private boolean active;
    private String mode = "", requestedProtocol = "AUTO_DETECT", detectedProtocol = "AUTO_DETECT";
    private String state = "idle", error = "", device = "", network = "", video = "";
    private long bytes, frames, crcErrors, rcFrames, startedAt, lastByteAt;
    private Position position;
    private byte[] carry = new byte[0];

    private static final class Position {
        double lat, lon, hdop = Double.NaN, accuracy = Double.NaN;
        int fixType = -1, satellites = -1;
        boolean validFix;
        long receivedAt;
    }

    DiagnosticSession(ConfigLink link) { this.link = link; }

    synchronized String start(String optionsJson) {
        reset();
        startedAt = System.currentTimeMillis();
        try {
            JSONObject options = new JSONObject(optionsJson == null ? "{}" : optionsJson);
            mode = options.optString("mode", "");
            requestedProtocol = options.optString("protocol", "AUTO_DETECT");
            if (!Arrays.asList("AUTO_DETECT", "MAVLINK", "GHST", "MSP").contains(requestedProtocol))
                throw new IllegalArgumentException("Unsupported receive protocol");
            String result;
            if ("usb".equals(mode)) {
                String port = options.optString("port", "");
                int baud = options.optInt("baud", 115200);
                if (port.isEmpty()) throw new IllegalArgumentException("Select a USB serial port");
                result = link.openUsb(port, baud, options.optBoolean("dtr", false));
                device = port + " at " + baud + " baud";
            } else if ("udp".equals(mode)) {
                int port = options.optInt("port", 14550);
                result = link.openUdp(port);
                device = "UDP receive port " + port;
                network = networkSummary(port);
            } else throw new IllegalArgumentException("Choose USB serial or UDP");
            active = true;
            updateLinkState(new JSONObject(result));
        } catch (Exception e) {
            active = false; state = "blocked"; error = message(e);
        }
        return snapshotInternal(false);
    }

    synchronized void stop() {
        active = false; link.close(); state = "idle"; error = "";
    }

    synchronized void reset() {
        stop(); mode = ""; requestedProtocol = "AUTO_DETECT"; detectedProtocol = "AUTO_DETECT";
        device = ""; network = ""; video = ""; bytes = frames = crcErrors = rcFrames = 0;
        startedAt = lastByteAt = 0; position = null; carry = new byte[0];
    }

    synchronized String snapshot() { return snapshotInternal(true); }

    private String snapshotInternal(boolean receive) {
        long now = System.currentTimeMillis();
        if (active) {
            try { updateLinkState(new JSONObject(link.status())); }
            catch (Exception e) { state = "blocked"; error = message(e); }
            if (receive && "listening".equals(state)) {
                String encoded = link.read();
                if (encoded != null && !encoded.isEmpty()) {
                    try {
                        byte[] data = Base64.decode(encoded, Base64.DEFAULT);
                        if (data.length > 0) { bytes += data.length; lastByteAt = now; parse(data); }
                    } catch (Exception e) { error = "Receive parse failed: " + message(e); }
                }
            }
        }
        now = System.currentTimeMillis();
        JSONObject row = new JSONObject();
        try {
            row.put("schema", "prismo.fieldkit.diagnostic.v1"); row.put("state", state);
            row.put("mode", mode); row.put("evidence", "device-observation"); row.put("device", device);
            row.put("protocol", "AUTO_DETECT".equals(requestedProtocol) ? detectedProtocol : requestedProtocol);
            row.put("bytes", bytes); row.put("frames", frames); row.put("crcErrors", crcErrors); row.put("rcFrames", rcFrames);
            row.put("byteAgeSeconds", lastByteAt == 0 ? JSONObject.NULL : Math.max(0, now - lastByteAt) / 1000.0);
            row.put("observedAt", now); row.put("network", network); row.put("video", video); row.put("error", error);
            if (position != null) {
                JSONObject p = new JSONObject(); p.put("lat", position.lat); p.put("lon", position.lon);
                p.put("fixType", position.fixType); p.put("validFix", position.validFix);
                if (position.satellites >= 0) p.put("satellites", position.satellites);
                if (Double.isFinite(position.hdop)) p.put("hdop", position.hdop);
                if (Double.isFinite(position.accuracy)) p.put("accuracy", position.accuracy); else p.put("accuracy", JSONObject.NULL);
                p.put("ageSeconds", Math.max(0, now - position.receivedAt) / 1000.0); row.put("position", p);
            }
        } catch (Exception ignored) { }
        return row.toString();
    }

    synchronized void probeVideo(String host, int port) {
        if (!active) { video = "Start a live receive session before probing video."; return; }
        if (host == null || host.trim().isEmpty() || host.length() > 253 || port < 1 || port > 65535) {
            video = "Enter a valid video host and TCP port."; return;
        }
        final String target = host.trim(); video = "Checking TCP " + target + ":" + port + "…";
        new Thread(() -> {
            String result;
            try (Socket socket = new Socket()) {
                socket.connect(new java.net.InetSocketAddress(target, port), 1800);
                result = "TCP " + target + ":" + port + " accepted a connection. Stream frames and latency are still unverified.";
            } catch (Exception e) { result = "TCP " + target + ":" + port + " was unavailable: " + message(e); }
            synchronized (DiagnosticSession.this) { video = result; }
        }, "fieldkit-video-probe").start();
    }

    private void updateLinkState(JSONObject status) {
        String nativeState = status.optString("state", "closed");
        if ("connected".equals(nativeState)) { state = "listening"; error = ""; }
        else if ("permission-pending".equals(nativeState)) { state = "permission-or-opening"; error = "Complete the Android USB permission prompt."; }
        else if ("error".equals(nativeState)) { state = "blocked"; error = status.optString("error", "Connection error"); }
        else { state = active ? "opening" : "idle"; }
        String id = status.optString("id", ""); if (!id.isEmpty() && device.isEmpty()) device = id;
    }

    private void parse(byte[] next) {
        int kept = Math.min(carry.length, 8192), incoming = Math.min(next.length, 16384);
        byte[] data = new byte[kept + incoming];
        System.arraycopy(carry, carry.length - kept, data, 0, kept);
        System.arraycopy(next, 0, data, kept, incoming);
        int i = 0;
        while (i < data.length) {
            int used = parseMavlink(data, i);
            if (used == 0) used = parseCrsf(data, i);
            if (used == 0) used = parseMsp(data, i);
            if (used < 0) break;
            if (used > 0) i += used; else i++;
        }
        int remain = Math.min(300, data.length - i);
        carry = remain > 0 ? Arrays.copyOfRange(data, i, i + remain) : new byte[0];
    }

    private int parseMavlink(byte[] data, int at) {
        int stx = u8(data, at); if (stx != 0xfd && stx != 0xfe) return 0;
        int header = stx == 0xfd ? 10 : 6;
        if (at + header > data.length) return -1;
        int len = u8(data, at + 1), signed = stx == 0xfd && (u8(data, at + 2) & 1) != 0 ? 13 : 0;
        int total = header + len + 2 + signed; if (at + total > data.length) return -1;
        int msg = stx == 0xfd ? u8(data,at+7)|(u8(data,at+8)<<8)|(u8(data,at+9)<<16) : u8(data,at+5);
        Integer extra = MAV_CRC.get(msg); if (extra == null) return 0;
        int crc = 0xffff;
        for (int p = at + 1; p < at + header + len; p++) crc = x25(crc, u8(data,p));
        crc = x25(crc, extra); int got = u8(data, at + header + len) | (u8(data, at + header + len + 1) << 8);
        if (crc != got) { crcErrors++; return total; }
        frames++; detectedProtocol = "MAVLINK"; int payload = at + header;
        if (msg == 65 || msg == 35) rcFrames++;
        if (msg == 24 && len >= 30) {
            Position p = new Position(); p.lat = i32le(data,payload+8)/1e7; p.lon = i32le(data,payload+12)/1e7;
            p.hdop = u16le(data,payload+20)/100.0; p.fixType = u8(data,payload+28); p.validFix = p.fixType >= 3;
            p.satellites = u8(data,payload+29); p.receivedAt = System.currentTimeMillis(); if (valid(p)) position = p;
        } else if (msg == 33 && len >= 16) {
            Position p = position == null ? new Position() : position; p.lat = i32le(data,payload+4)/1e7; p.lon = i32le(data,payload+8)/1e7;
            if (p.fixType < 0) { p.fixType = 3; p.validFix = true; } p.receivedAt = System.currentTimeMillis(); if (valid(p)) position = p;
        }
        return total;
    }

    private int parseCrsf(byte[] data, int at) {
        int address = u8(data,at); if (address != 0xc8 && address != 0xea && address != 0xec && address != 0xee && address != 0x89) return 0;
        if (at + 2 > data.length) return -1;
        int len = u8(data,at+1), total = len + 2; if (len < 2 || len > 64) return 0;
        if (at + total > data.length) return -1;
        int crc = 0; for (int p=at+2;p<at+total-1;p++) crc=crc8(crc,u8(data,p));
        if (crc != u8(data,at+total-1)) { crcErrors++; return total; }
        frames++; detectedProtocol = "GHST"; int type=u8(data,at+2); if(type==0x16)rcFrames++;
        if(type==0x02&&len>=17){Position p=new Position();p.lat=i32be(data,at+3)/1e7;p.lon=i32be(data,at+7)/1e7;p.satellites=u8(data,at+17);p.fixType=p.satellites>0?3:0;p.validFix=p.fixType>=3;p.receivedAt=System.currentTimeMillis();if(valid(p))position=p;}
        return total;
    }

    private int parseMsp(byte[] d,int at){
        if(at+6>d.length||u8(d,at)!='$'||(u8(d,at+1)!='M'&&u8(d,at+1)!='X'))return 0;
        if(u8(d,at+1)=='M'){
            int n=u8(d,at+3),total=6+n;if(at+total>d.length)return -1;int sum=0;for(int p=at+3;p<at+5+n;p++)sum^=u8(d,p);
            if(sum!=u8(d,at+5+n))crcErrors++;else{frames++;detectedProtocol="MSP";}return total;
        }
        if(at+9>d.length)return -1;int n=u16le(d,at+6),total=9+n;if(n>4096)return 0;if(at+total>d.length)return -1;
        int crc=0;for(int p=at+3;p<at+8+n;p++)crc=crc8(crc,u8(d,p));if(crc!=u8(d,at+8+n))crcErrors++;else{frames++;detectedProtocol="MSP";}return total;
    }

    private static boolean valid(Position p){return Double.isFinite(p.lat)&&Double.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
    private static int u8(byte[] b,int i){return i>=0&&i<b.length?b[i]&255:0;}
    private static int u16le(byte[] b,int i){return u8(b,i)|(u8(b,i+1)<<8);}
    private static int i32le(byte[] b,int i){return u8(b,i)|(u8(b,i+1)<<8)|(u8(b,i+2)<<16)|(b[i+3]<<24);}
    private static int i32be(byte[] b,int i){return (b[i]<<24)|(u8(b,i+1)<<16)|(u8(b,i+2)<<8)|u8(b,i+3);}
    private static int x25(int crc,int value){int tmp=value^(crc&255);tmp^=(tmp<<4)&255;return ((crc>>8)^(tmp<<8)^(tmp<<3)^(tmp>>4))&65535;}
    private static int crc8(int crc,int value){crc^=value;for(int i=0;i<8;i++)crc=(crc&0x80)!=0?((crc<<1)^0xd5)&255:(crc<<1)&255;return crc;}
    private static String message(Exception e){String m=e.getMessage();return m==null||m.trim().isEmpty()?e.getClass().getSimpleName():m;}
    private static String networkSummary(int port){
        StringBuilder out=new StringBuilder("Send telemetry to ");
        try{for(NetworkInterface n:Collections.list(NetworkInterface.getNetworkInterfaces()))for(InetAddress a:Collections.list(n.getInetAddresses()))if(a instanceof Inet4Address&&!a.isLoopbackAddress())out.append(a.getHostAddress()).append(':').append(port).append(" or ");}catch(Exception ignored){}
        if(out.toString().endsWith(" or "))out.setLength(out.length()-4);else out.append("this phone on UDP port ").append(port);return out.toString();
    }
}
