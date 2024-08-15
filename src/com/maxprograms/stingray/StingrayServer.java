/*******************************************************************************
 * Copyright (c) 2008 - 2024 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

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

import javax.xml.parsers.ParserConfigurationException;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import org.json.JSONException;
import org.json.JSONObject;
import org.xml.sax.SAXException;

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
		server.setExecutor(new ThreadPoolExecutor(3, 10, 20, TimeUnit.SECONDS, new ArrayBlockingQueue<>(100)));
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
				case "/stop":
					logger.log(Level.INFO, "Stop requested");
					response = stop();
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
				case "/exportExcel":
					response = exportExcel(new JSONObject(request));
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
				case "/mergeNext":
					response = mergeNext(new JSONObject(request));
					break;
				case "/saveData":
					response = saveData(new JSONObject(request));
					break;
				case "/splitSegment":
					response = splitSegment(new JSONObject(request));
					break;
				case "/replaceText":
					response = replaceText(new JSONObject(request));
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
				case "/systemInfo":
					response = getSystemInformation();
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
		} catch (IOException | JSONException | SAXException | ParserConfigurationException e) {
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

	private String getFileInfo() throws JSONException, SAXException, IOException, ParserConfigurationException {
		return service.getFileInfo().toString();
	}

	private String getRows(JSONObject json) throws SAXException, IOException, ParserConfigurationException {
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

	private String exportExcel(JSONObject json) {
		return service.exportExcel(json).toString();
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

	private String mergeNext(JSONObject json) {
		return service.mergeNext(json).toString();
	}

	private String removeSegment(JSONObject json) {
		return service.removeSegment(json).toString();
	}

	private String saveData(JSONObject json) {
		return service.saveData(json).toString();
	}

	private String splitSegment(JSONObject json) {
		return service.splitSegment(json).toString();
	}

	private String replaceText(JSONObject json) {
		return service.replaceText(json).toString();
	}

	private static String getSystemInformation() {
		JSONObject result = new JSONObject();
		result.put("stingray", Constants.VERSION + " Build: " + Constants.BUILD);
		result.put("openxliff",
				com.maxprograms.converters.Constants.VERSION + " Build: " + com.maxprograms.converters.Constants.BUILD);
		result.put("xmljava",
				com.maxprograms.xml.Constants.VERSION + " Build: " + com.maxprograms.xml.Constants.BUILD);
		result.put("java", System.getProperty("java.version") + " Vendor: " + System.getProperty("java.vendor"));
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result.toString();
	}

	private String stop() {
		logger.log(Level.INFO, "Stopping server");
		JSONObject result = new JSONObject();
		JSONObject status = service.savingStatus();
		while (status.getBoolean("saving")) {
			try {
				Thread.sleep(500);
				status = service.savingStatus();
			} catch (InterruptedException e) {
				logger.log(Level.ERROR, e);
				result.put(Constants.STATUS, Constants.ERROR);
				result.put(Constants.REASON, e.getMessage());
			}
		}
		if (!result.has("reason")) {
			result.put(Constants.STATUS, Constants.SUCCESS);
		}
		return result.toString();
	}
}