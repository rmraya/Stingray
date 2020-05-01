package com.maxprograms.stingray;

import java.io.IOException;
import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.util.List;

import javax.xml.parsers.ParserConfigurationException;

import com.maxprograms.languages.Language;
import com.maxprograms.languages.LanguageUtils;

import org.json.JSONArray;
import org.json.JSONObject;
import org.xml.sax.SAXException;

public class AlignmentService {

	private static Logger logger = System.getLogger(AlignmentService.class.getName());

	public AlignmentService() {
		// TODO
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
		} catch (SAXException | IOException | ParserConfigurationException e) {
			logger.log(Level.ERROR, "Error getting languages", e);
			result.put(Constants.REASON, e.getMessage());
		}
		return result;
	}
}
