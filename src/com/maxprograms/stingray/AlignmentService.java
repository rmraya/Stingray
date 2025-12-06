/*******************************************************************************
 * Copyright (c) 2008 - 2025 Maxprograms.
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

import java.io.File;
import java.io.IOException;
import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import javax.xml.parsers.ParserConfigurationException;

import com.maxprograms.converters.Convert;
import com.maxprograms.converters.EncodingResolver;
import com.maxprograms.converters.FileFormats;
import com.maxprograms.languages.Language;
import com.maxprograms.languages.LanguageUtils;
import com.maxprograms.stingray.models.Alignment;
import com.maxprograms.xml.Document;
import com.maxprograms.xml.Element;
import com.maxprograms.xml.SAXBuilder;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xml.sax.SAXException;

public class AlignmentService {

	private static Logger logger = System.getLogger(AlignmentService.class.getName());
	protected boolean aligning;
	protected String alignError;
	protected String status;

	protected boolean loading;
	protected String loadError;
	protected Alignment alignment;

	protected boolean saving;
	protected String saveError;

	public AlignmentService() {
		loading = false;
		saving = false;
		aligning = false;
	}

	public JSONObject getLanguages() {
		JSONObject result = new JSONObject();
		try {
			List<Language> languages = LanguageUtils.getCommonLanguages();
			JSONArray array = new JSONArray();
			for (int i = 0; i < languages.size(); i++) {
				Language lang = languages.get(i);
				JSONObject json = new JSONObject();
				json.put("code", lang.getCode());
				json.put("description", lang.getDescription());
				array.put(json);
			}
			result.put("languages", array);
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (SAXException | IOException | ParserConfigurationException e) {
			logger.log(Level.ERROR, Messages.getString("AlignmentService.1"), e);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject getTypes() {
		JSONObject result = new JSONObject();
		JSONArray array = new JSONArray();
		String[] formats = FileFormats.getFormats();
		for (int i = 0; i < formats.length; i++) {
			if (!FileFormats.isBilingual(formats[i])) {
				JSONObject json = new JSONObject();
				json.put("code", FileFormats.getShortName(formats[i]));
				json.put("description", formats[i]);
				array.put(json);
			}
		}
		result.put("types", array);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject getCharsets() {
		JSONObject result = new JSONObject();
		JSONArray array = new JSONArray();
		TreeMap<String, Charset> charsets = new TreeMap<>(Charset.availableCharsets());
		Set<String> keys = charsets.keySet();
		Iterator<String> i = keys.iterator();
		while (i.hasNext()) {
			Charset cset = charsets.get(i.next());
			JSONObject json = new JSONObject();
			json.put("code", cset.name());
			json.put("description", cset.displayName());
			array.put(json);
		}
		result.put("charsets", array);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject getFileType(String file) {
		JSONObject result = new JSONObject();
		result.put("file", file);
		String detected = FileFormats.detectFormat(file);
		if (detected != null) {
			String type = FileFormats.getShortName(detected);
			if (type != null) {
				Charset charset = EncodingResolver.getEncoding(file, detected);
				if (charset != null) {
					result.put("charset", charset.name());
				}
			}
			result.put("type", type);
		}
		return result;
	}

	public JSONObject alignFiles(JSONObject json) {
		JSONObject result = new JSONObject();
		aligning = true;
		alignError = "";
		status = "";
		try {
			new Thread() {

				@Override
				public void run() {
					try {
						status = Messages.getString("AlignmentService.2");
						logger.log(Level.INFO, status);
						File srcXlf = File.createTempFile("file", ".xlf");
						srcXlf.deleteOnExit();
						File skl = File.createTempFile("file", ".skl");
						Map<String, String> params = new HashMap<>();
						params.put("source", json.getString("sourceFile"));
						params.put("srcLang", json.getString("srcLang"));
						params.put("xliff", srcXlf.getAbsolutePath());
						params.put("skeleton", skl.getAbsolutePath());
						params.put("format", FileFormats.getFullName(json.getString("srcType")));
						params.put("catalog", json.getString("catalog"));
						params.put("srcEncoding", json.getString("srcEnc"));
						params.put("paragraph", json.getBoolean("paragraph") ? "yes" : "no");
						params.put("srxFile", json.getString("srx"));
						params.put("xmlfilter", json.getString("xmlfilter"));
						List<String> res = Convert.run(params);
						if (!com.maxprograms.converters.Constants.SUCCESS.equals(res.get(0))) {
							alignError = res.get(1);
							status = "";
							aligning = false;
							return;
						}
						Files.delete(skl.toPath());

						status = Messages.getString("AlignmentService.3");
						logger.log(Level.INFO, status);
						File tgtXlf = File.createTempFile("file", ".xlf");
						tgtXlf.deleteOnExit();
						skl = File.createTempFile("file", ".skl");
						params = new HashMap<>();
						params.put("source", json.getString("targetFile"));
						params.put("srcLang", json.getString("tgtLang"));
						params.put("xliff", tgtXlf.getAbsolutePath());
						params.put("skeleton", skl.getAbsolutePath());
						params.put("format", FileFormats.getFullName(json.getString("tgtType")));
						params.put("catalog", json.getString("catalog"));
						params.put("srcEncoding", json.getString("tgtEnc"));
						params.put("paragraph", json.getBoolean("paragraph") ? "yes" : "no");
						params.put("srxFile", json.getString("srx"));
						params.put("xmlfilter", json.getString("xmlfilter"));
						res = Convert.run(params);
						if (!com.maxprograms.converters.Constants.SUCCESS.equals(res.get(0))) {
							alignError = res.get(1);
							status = "";
							aligning = false;
							return;
						}
						Files.delete(skl.toPath());

						status = Messages.getString("AlignmentService.4");
						logger.log(Level.INFO, status);

						Alignment algn = new Alignment(json.getString("srcLang"), json.getString("tgtLang"));
						algn.setFile(json.getString("alignmentFile"));

						SAXBuilder builder = new SAXBuilder();
						Document doc = builder.build(srcXlf);
						List<Element> list = new ArrayList<>();
						recurse(list, doc.getRootElement());
						algn.setSources(list);
						Files.delete(srcXlf.toPath());

						doc = builder.build(tgtXlf);
						list.clear();
						recurse(list, doc.getRootElement());
						algn.setTargets(list);
						Files.delete(tgtXlf.toPath());

						algn.save();

						status = "";
						aligning = false;
						logger.log(Level.INFO, Messages.getString("AlignmentService.5"));
					} catch (IOException | SAXException | ParserConfigurationException e) {
						logger.log(Level.ERROR, e);
						alignError = e.getMessage();
						status = "";
						aligning = false;
					}
				}

				private void recurse(List<Element> list, Element e) {
					if (e.getName().equals("trans-unit")) {
						list.add(e.getChild("source"));
					} else {
						List<Element> children = e.getChildren();
						Iterator<Element> it = children.iterator();
						while (it.hasNext()) {
							recurse(list, it.next());
						}
					}
				}

			}.start();
			result.put(Constants.STATUS, Constants.SUCCESS);
			return result;
		} catch (IllegalThreadStateException e) {
			logger.log(Level.ERROR, e);
			alignError = e.getMessage();
			status = "";
			aligning = false;
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject alignmentStatus() {
		JSONObject result = new JSONObject();
		result.put("aligning", aligning);
		result.put("alignError", alignError);
		result.put("status", status);
		return result;
	}

	public JSONObject openFile(JSONObject json) {
		JSONObject result = new JSONObject();
		loading = true;
		loadError = "";
		status = Messages.getString("AlignmentService.6");
		try {
			new Thread() {

				@Override
				public void run() {
					try {
						alignment = new Alignment(json.getString("file"));
						status = "";
						loading = false;
					} catch (JSONException | SAXException | IOException | ParserConfigurationException e) {
						logger.log(Level.ERROR, e);
						loadError = e.getMessage();
						status = "";
						loading = false;
					}
				}
			}.start();
			result.put(Constants.STATUS, Constants.SUCCESS);
			return result;
		} catch (IllegalThreadStateException e) {
			logger.log(Level.ERROR, e);
			loadError = e.getMessage();
			status = "";
			loading = false;
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject loadingStatus() {
		JSONObject result = new JSONObject();
		result.put("loading", loading);
		result.put("loadError", loadError);
		result.put("status", status);
		return result;
	}

	public JSONObject getFileInfo() throws JSONException, SAXException, IOException, ParserConfigurationException {
		JSONObject result = alignment.getFileInfo();
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject getRows(JSONObject json) throws SAXException, IOException, ParserConfigurationException {
		JSONObject result = alignment.getRows(json);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject exportTMX(JSONObject json) {
		JSONObject result = new JSONObject();
		try {
			alignment.exportTMX(json.getString("file"));
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (JSONException | IOException | SAXException | ParserConfigurationException e) {
			logger.log(Level.ERROR, e);
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject saveFile() {
		JSONObject result = new JSONObject();
		saving = true;
		saveError = "";
		status = Messages.getString("AlignmentService.7");

		try {
			new Thread() {

				@Override
				public void run() {
					try {
						alignment.save();
						saving = false;
						status = "";
					} catch (JSONException | IOException e) {
						saving = false;
						logger.log(Level.ERROR, e);
						saveError = e.getMessage();
						status = "";
					}
				}
			}.start();
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (IllegalThreadStateException e) {
			logger.log(Level.ERROR, e);
			saving = false;
			saveError = e.getMessage();
			status = "";
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject savingStatus() {
		JSONObject result = new JSONObject();
		result.put("saving", saving);
		result.put("saveError", saveError);
		result.put("status", status);
		return result;
	}

	public JSONObject removeTags() {
		JSONObject result = new JSONObject();
		alignment.removeTags();
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject exportCSV(JSONObject json) {
		JSONObject result = new JSONObject();
		try {
			alignment.exportCSV(json.getString("file"));
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (IOException e) {
			logger.log(Level.ERROR, e);
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject exportExcel(JSONObject json) {
		JSONObject result = new JSONObject();
		try {
			alignment.exportExcel(json.getString("file"));
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (IOException | JSONException | SAXException | ParserConfigurationException e) {
			logger.log(Level.ERROR, e);
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject setLanguages(JSONObject json) {
		JSONObject result = new JSONObject();
		try {
			alignment.setLanguages(json);
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (JSONException | IOException | SAXException | ParserConfigurationException e) {
			logger.log(Level.ERROR, e);
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject closeFile() {
		JSONObject result = new JSONObject();
		alignment = null;
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject removeDuplicates() {
		JSONObject result = new JSONObject();
		alignment.removeDuplicates();
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject renameFile(JSONObject json) {
		JSONObject result = new JSONObject();
		alignment.setFile(json.getString("file"));
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject removeSegment(JSONObject json) {
		JSONObject result = new JSONObject();
		alignment.removeSegment(json);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject segmentDown(JSONObject json) {
		JSONObject result = new JSONObject();
		alignment.segmentDown(json);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject segmentUp(JSONObject json) {
		JSONObject result = new JSONObject();
		alignment.segmentUp(json);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject mergeNext(JSONObject json) {
		JSONObject result = new JSONObject();
		alignment.mergeNext(json);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject saveData(JSONObject json) {
		JSONObject result = new JSONObject();
		try {
			alignment.saveData(json);
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (SAXException | IOException | ParserConfigurationException e) {
			logger.log(Level.ERROR, e);
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

	public JSONObject replaceText(JSONObject json) {
		JSONObject result = new JSONObject();
		alignment.replaceText(json);
		result.put(Constants.STATUS, Constants.SUCCESS);
		return result;
	}

	public JSONObject splitSegment(JSONObject json) {
		JSONObject result = new JSONObject();
		try {
			alignment.splitSegment(json);
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (SAXException | IOException | ParserConfigurationException e) {
			logger.log(Level.ERROR, e);
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}

    public JSONObject insertCell(JSONObject json) {
        JSONObject result = new JSONObject();
		try {
			alignment.insertCell(json);
			result.put(Constants.STATUS, Constants.SUCCESS);
		} catch (SAXException | IOException | ParserConfigurationException e) {
			logger.log(Level.ERROR, e);
			result.put(Constants.STATUS, Constants.ERROR);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
    }
}
