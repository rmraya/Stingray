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

package com.maxprograms.stingray.models;

import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.List;

import javax.xml.parsers.ParserConfigurationException;

import com.maxprograms.languages.Language;
import com.maxprograms.languages.LanguageUtils;
import com.maxprograms.xml.Document;
import com.maxprograms.xml.Element;
import com.maxprograms.xml.SAXBuilder;
import com.maxprograms.xml.TextNode;
import com.maxprograms.xml.XMLNode;
import com.maxprograms.xml.XMLOutputter;
import com.maxprograms.xml.XMLUtils;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xml.sax.SAXException;

public class Alignment {

    private String file;
    private Document doc;
    private List<Element> sources;
    private Language srcLang;
    private List<Element> targets;
    private Language tgtLang;

    public Alignment(String file) throws SAXException, IOException, ParserConfigurationException {
        this.file = file;
        SAXBuilder builder = new SAXBuilder();
        doc = builder.build(file);
        sources = doc.getRootElement().getChild("sources").getChildren();
        srcLang = LanguageUtils.getLanguage(doc.getRootElement().getChild("sources").getAttributeValue("xml:lang"));
        targets = doc.getRootElement().getChild("targets").getChildren();
        tgtLang = LanguageUtils.getLanguage(doc.getRootElement().getChild("targets").getAttributeValue("xml:lang"));
    }

    public void save() throws IOException {
        XMLOutputter outputter = new XMLOutputter();
        try (FileOutputStream out = new FileOutputStream(file)) {
            outputter.output(doc, out);
        }
    }

    public JSONObject getFileInfo() throws JSONException, IOException {
        JSONObject result = new JSONObject();
        result.put("file", file);
        result.put("srcLang", jsonLang(srcLang));
        result.put("tgtLang", jsonLang(tgtLang));
        result.put("srcRows", sources.size());
        result.put("tgtRows", targets.size());
        return result;
    }

    private JSONObject jsonLang(Language lang) {
        JSONObject result = new JSONObject();
        result.put("code", lang.getCode());
        result.put("description", lang.getDescription());
        result.put("bidi", lang.isBiDi());
        return result;
    }

    public JSONArray getRows(JSONObject json) {
        JSONArray result = new JSONArray();
        int start = json.getInt("start");
        int count = json.getInt("count");
        for (int i = 0; i < count; i++) {
            StringBuilder row = new StringBuilder();
            row.append("<tr><td class='fixed'>");
            row.append(start + i);
            row.append("</td><td");
            if (srcLang.isBiDi()) {
                row.append(" dir=\"rtl\"");
            }
            row.append(" lang=\"");
            row.append(srcLang.getCode());
            row.append("\">");
            row.append(getContent(sources, start + i));
            row.append("</td><td");
            if (tgtLang.isBiDi()) {
                row.append(" dir=\"rtl\"");
            }
            row.append(" lang=\"");
            row.append(tgtLang.getCode());
            row.append("\">");
            row.append(getContent(targets, start + i));
            row.append("</td></tr>");
            result.put(row.toString());
        }
        return result;
    }

    private Object getContent(List<Element> list, int row) {
        if (row < list.size()) {
            return pureText(list.get(row));
        }
        return "";
    }

    private String pureText(Element element) {
        int tag = 1;
        StringBuilder result = new StringBuilder();
        List<XMLNode> content = element.getContent();
        Iterator<XMLNode> it = content.iterator();
        while (it.hasNext()) {
            XMLNode node = it.next();
            if (node.getNodeType() == XMLNode.TEXT_NODE) {
                result.append(XMLUtils.cleanText(((TextNode) node).getText()));
            } else if (node.getNodeType() == XMLNode.ELEMENT_NODE) {
                Element e = (Element) node;
                String type = e.getName();
                if ("ph".equals(type)) {
                    result.append(makeSVG(tag++));
                }
                if ("g".equals(type)) {
                    result.append(makeSVG(tag++));
                    result.append(pureText(e));
                    result.append(makeSVG(tag++));
                }
            }
        }
        return result.toString();
    }

    private String makeSVG(int tag) {
        int width = 16;
        if (tag >= 10) {
            width = 22;
        }
        if (tag >= 100) {
            width = 28;
        }
        return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + (width + 1)
                + "px\" height=\"17px\" version=\"1.1\"><g><rect style=\"fill:#009688\" width=\"" + width
                + "px\" height=\"16px\" x=\"1\" y=\"1\" rx=\"3\" ry=\"3\" />"
                + "<text style=\"font-size:12px;font-style:normal;font-weight:normal;text-align:center;\""
                + " x=\"6\" y=\"14\" fill=\"#ffffff\" fill-opacity=\"1\">" + tag + "</text></g></svg>";
    }

}