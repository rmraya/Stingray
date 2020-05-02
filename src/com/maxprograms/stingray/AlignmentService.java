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

import java.io.IOException;
import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.nio.charset.Charset;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;

import javax.xml.parsers.ParserConfigurationException;

import com.maxprograms.converters.EncodingResolver;
import com.maxprograms.converters.FileFormats;
import com.maxprograms.languages.Language;
import com.maxprograms.languages.LanguageUtils;

import org.json.JSONArray;
import org.json.JSONObject;
import org.xml.sax.SAXException;

public class AlignmentService {

	private static Logger logger = System.getLogger(AlignmentService.class.getName());

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
		} catch (SAXException | IOException | ParserConfigurationException e) {
			logger.log(Level.ERROR, "Error getting languages", e);
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
}
