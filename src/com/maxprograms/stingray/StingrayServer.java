/*****************************************************************************
Copyright (c) 2008-2020 - Maxprograms,  http://www.maxprograms.com/

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and associated documentation files (the "Software"), to compile, 
modify and use the Software in its executable form without restrictions.

Redistribution of this Software or parts of it in any form (source code or 
executable binaries) requires prior written permission from Maxprograms.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE 
SOFTWARE.
*****************************************************************************/

package com.maxprograms.stingray;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import org.json.JSONObject;

public class StingrayServer implements HttpHandler {

	private static Logger logger = System.getLogger(StingrayServer.class.getName());
	private HttpServer server;
	private AlignmentService service;
	private boolean debug;

	public static void main(String[] args) {
		String port = "8040";
		boolean shouldDebug = false;
		for (int i = 0; i < args.length; i++) {
			String arg = args[i];
			if (arg.equals("-version")) {
				logger.log(Level.INFO, () -> "Version: " + Constants.VERSION + " Build: " + Constants.BUILD);
				return;
			}
			if (arg.equals("-port") && (i + 1) < args.length) {
				port = args[i + 1];
			}
			if (arg.equals("-debug")) {
				shouldDebug = true;
			}
		}
		try {
			StingrayServer instance = new StingrayServer(Integer.valueOf(port));
			instance.setDebug(shouldDebug);
			instance.run();
		} catch (Exception e) {
			logger.log(Level.ERROR, "Server error", e);
		}
	}

	public StingrayServer(Integer port) throws IOException {
		server = HttpServer.create(new InetSocketAddress(port), 0);
		server.createContext("/", this);
		server.setExecutor(new ThreadPoolExecutor(3, 10, 20, TimeUnit.SECONDS, new ArrayBlockingQueue<Runnable>(100)));
		service = new AlignmentService();
	}

	@Override
	public void handle(HttpExchange exchange) throws IOException {
		try {
			String request = "";
			String url = exchange.getRequestURI().toString();
			try (InputStream is = exchange.getRequestBody()) {
				request = readRequestBody(is);
			}
			if (debug) {
				logger.log(Level.INFO, request);
			}
			String response = "{}";
			switch (url) {
				case "/version":
					JSONObject obj = new JSONObject();
					obj.put("tool", "StingrayServer");
					obj.put("version", Constants.VERSION);
					obj.put("build", Constants.BUILD);
					response = obj.toString();
					break;
				case "/stop":
					logger.log(Level.INFO, "Stop requested");
					break;
				case "/getLanguages":
					response = getLanguages();
					break;
				case "/getTypes":
					response = getTypes();
					break;
				case "/getCharsets":
					response = getCharsets();
					break;
				case "/getFileType":
					response = getFileType(new JSONObject(request));
					break;
				case "/alignFiles":
					response = alignFiles(new JSONObject(request));
					break;
				case "/alignmentStatus":
					response = alignmentStatus();
					break;
				case "/openFile":
					response = openFile(new JSONObject(request));
					break;
				case "/loadingStatus":
					response = loadingStatus();
					break;
				case "/getFileInfo":
					response = getFileInfo();
					break;
				case "/getRows":
					response = getRows(new JSONObject(request));
					break;
				case "/exportTMX":
					response = exportTMX(new JSONObject(request));
					break;
				case "/exportCSV":
					response = exportCSV(new JSONObject(request));
					break;
				case "/saveFile":
					response = saveFile();
					break;
				case "/renameFile":
					response = renameFile(new JSONObject(request));
					break;
				case "/savingStatus":
					response = savingStatus();
					break;
				case "/segmentDown":
					response = segmentDown(new JSONObject(request));
					break;
				case "/segmentUp":
					response = segmentUp(new JSONObject(request));
					break;
				case "/removeSegment":
					response = removeSegment(new JSONObject(request));
					break;
				case "/removeTags":
					response = removeTags();
					break;
				case "/removeDuplicates":
					response = removeDuplicates();
					break;
				case "/setLanguages":
					response = setLanguages(new JSONObject(request));
					break;
				case "/closeFile":
					response = closeFile();
					break;
				default:
					JSONObject unknown = new JSONObject();
					unknown.put(Constants.STATUS, Constants.ERROR);
					unknown.put(Constants.REASON, "Unknown request");
					unknown.put("received", url);
					response = unknown.toString();
			}
			if (debug) {
				logger.log(Level.INFO, response);
			}
			exchange.getResponseHeaders().add("content-type", "application/json; charset=utf-8");
			byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
			exchange.sendResponseHeaders(200, bytes.length);
			try (ByteArrayInputStream stream = new ByteArrayInputStream(bytes)) {
				try (OutputStream os = exchange.getResponseBody()) {
					byte[] array = new byte[2048];
					int read;
					while ((read = stream.read(array)) != -1) {
						os.write(array, 0, read);
					}
				}
			}
			if ("/stop".equals(url)) {
				logger.log(Level.INFO, "Stopping server");
				JSONObject status = service.savingStatus();
				while (status.getBoolean("saving")) {
					try {
						Thread.sleep(500);
					} catch (InterruptedException e) {
						logger.log(Level.ERROR, e);
						Thread.currentThread().interrupt();
					}
					status = service.savingStatus();
				}
				System.exit(0);
			}
		} catch (IOException e) {
			logger.log(Level.ERROR, e);
			String message = e.getMessage();
			exchange.sendResponseHeaders(500, message.length());
			try (OutputStream os = exchange.getResponseBody()) {
				os.write(message.getBytes());
			}
		}
	}

	private void run() {
		server.start();
		logger.log(Level.INFO, "StingrayServer started");
	}

	protected static String readRequestBody(InputStream is) throws IOException {
		StringBuilder request = new StringBuilder();
		try (BufferedReader rd = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
			String line;
			while ((line = rd.readLine()) != null) {
				request.append(line);
			}
		}
		return request.toString();
	}

	private void setDebug(boolean value) {
		debug = value;
	}

	private String getLanguages() {
		return service.getLanguages().toString();
	}

	private String getTypes() {
		return service.getTypes().toString();
	}

	private String getCharsets() {
		return service.getCharsets().toString();
	}

	private String alignFiles(JSONObject json) {
		return service.alignFiles(json).toString();
	}

	private String alignmentStatus() {
		return service.alignmentStatus().toString();
	}

	private String openFile(JSONObject json) {
		return service.openFile(json).toString();
	}

	private String loadingStatus() {
		return service.loadingStatus().toString();
	}

	private String getFileInfo() {
		return service.getFileInfo().toString();
	}

	private String getRows(JSONObject json) {
		return service.getRows(json).toString();
	}

	private String exportTMX(JSONObject json) {
		return service.exportTMX(json).toString();
	}

	private String saveFile() {
		return service.saveFile().toString();
	}

	private String renameFile(JSONObject json) {
		return service.renameFile(json).toString();
	}

	private String exportCSV(JSONObject json) {
		return service.exportCSV(json).toString();
	}

	private String removeTags() {
		return service.removeTags().toString();
	}

	private String removeDuplicates() {
		return service.removeDuplicates().toString();
	}

	private String getFileType(JSONObject json) {
		return service.getFileType(json.getString("file")).toString();
	}

	private String setLanguages(JSONObject json) {
		return service.setLanguages(json).toString();
	}

	private String savingStatus() {
		return service.savingStatus().toString();
	}

	private String closeFile() {
		return service.closeFile().toString();
	}

	private String segmentDown(JSONObject json) {
		return service.segmentDown(json).toString();
	}
	private String segmentUp(JSONObject json) {
		return service.segmentUp(json).toString();
	}

	private String removeSegment(JSONObject json) {
		return service.removeSegment(json).toString();
	}
}