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

import java.io.ByteArrayInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import javax.xml.parsers.ParserConfigurationException;

import com.maxprograms.languages.Language;
import com.maxprograms.languages.LanguageUtils;
import com.maxprograms.stingray.Constants;
import com.maxprograms.xml.Document;
import com.maxprograms.xml.Element;
import com.maxprograms.xml.Indenter;
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

    public Alignment(String source, String target) throws IOException {
        doc = new Document(null, "algnproject", null, null);
        srcLang = LanguageUtils.getLanguage(source);
        tgtLang = LanguageUtils.getLanguage(target);
        Element root = doc.getRootElement();
        root.setAttribute("version", Constants.VERSION);
        root.setAttribute("build", Constants.BUILD);
        Element src = new Element("sources");
        src.setAttribute("xml:lang", source);
        root.addContent(src);
        sources = src.getChildren();
        Element tgt = new Element("targets");
        tgt.setAttribute("xml:lang", target);
        root.addContent(tgt);
        targets = tgt.getChildren();
    }

    public Alignment(String file) throws SAXException, IOException, ParserConfigurationException {
        this.file = file;
        SAXBuilder builder = new SAXBuilder();
        doc = builder.build(file);
        sources = doc.getRootElement().getChild("sources").getChildren();
        srcLang = LanguageUtils.getLanguage(doc.getRootElement().getChild("sources").getAttributeValue("xml:lang"));
        targets = doc.getRootElement().getChild("targets").getChildren();
        tgtLang = LanguageUtils.getLanguage(doc.getRootElement().getChild("targets").getAttributeValue("xml:lang"));
    }

    public void setFile(String file) {
        this.file = file;
    }

    public void setSources(List<Element> list) {
        List<XMLNode> content = new ArrayList<>();
        content.addAll(list);
        doc.getRootElement().getChild("sources").setContent(content);
    }

    public void setTargets(List<Element> list) {
        List<XMLNode> content = new ArrayList<>();
        content.addAll(list);
        doc.getRootElement().getChild("targets").setContent(content);
    }

    public void save() throws IOException, SAXException, ParserConfigurationException {
        trimSpaces();
        XMLOutputter outputter = new XMLOutputter();
        outputter.preserveSpace(true);
        Indenter.indent(doc.getRootElement(), 2);
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
            if (start + i >= sources.size() && start + i >= targets.size()) {
                break;
            }
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

    private String getContent(List<Element> list, int row) {
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

    public int removeDuplicates() {
        int removed = 0;
        for (int i = 0; i < sources.size() - 1; i++) {
            Element src = sources.get(i);
            for (int h = i + 1; h < sources.size(); h++) {
                Element next = sources.get(h);
                if (src.equals(next) && h < targets.size()) {
                    Element tgt = targets.get(i);
                    Element tgtnext = targets.get(h);
                    if (tgt.equals(tgtnext)) {
                        sources.remove(h);
                        targets.remove(h);
                        removed++;
                    }
                }
            }
        }
        return removed;
    }

    public void trimSpaces()
            throws UnsupportedEncodingException, SAXException, IOException, ParserConfigurationException {
        SAXBuilder builder = new SAXBuilder();
        for (int i = 0; i < sources.size(); i++) {
            Element src = sources.get(i);
            String text = "<source>" + extractText(src).strip() + "</source>";
            Element root1 = builder.build(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)))
                    .getRootElement();
            src.setContent(root1.getContent());
        }
        for (int i = 0; i < targets.size(); i++) {
            Element tgt = targets.get(i);
            String text = "<source>" + extractText(tgt).strip() + "</source>";
            Element root1 = builder.build(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)))
                    .getRootElement();
            tgt.setContent(root1.getContent());
        }
    }

    private static String extractText(Element e) {
        StringBuilder result = new StringBuilder();
        List<XMLNode> list = e.getContent();
        Iterator<XMLNode> it = list.iterator();
        while (it.hasNext()) {
            XMLNode node = it.next();
            if (node.getNodeType() == XMLNode.TEXT_NODE) {
                result.append(node.toString());
            }
            if (node.getNodeType() == XMLNode.ELEMENT_NODE) {
                result.append(((Element) node).toString());
            }
        }
        return result.toString();
    }

    public void removeTags() {
        for (int i = 0; i < sources.size(); i++) {
            Element src = sources.get(i);
            src.setText(getPureText(src));
        }
        for (int i = 0; i < targets.size(); i++) {
            Element tgt = targets.get(i);
            tgt.setText(getPureText(tgt));
        }
    }

    private static String getPureText(Element element) {
        StringBuilder result = new StringBuilder();
        List<XMLNode> nodes = element.getContent();
        Iterator<XMLNode> it = nodes.iterator();
        while (it.hasNext()) {
            XMLNode node = it.next();
            if (node.getNodeType() == XMLNode.TEXT_NODE) {
                result.append(((TextNode) node).getText());
            }
            if (node.getNodeType() == XMLNode.ELEMENT_NODE) {
                Element e = (Element) node;
                String type = e.getName();
                if ("g".equals(type)) {
                    result.append(getPureText(e));
                }
            }
        }
        return result.toString();
    }

    public void exportTMX(String tmxFile) throws IOException {
        Document tmx = new Document(null, "tmx", "-//LISA OSCAR:1998//DTD for Translation Memory eXchange//EN",
                "tmx14.dtd");
        Element root = tmx.getRootElement();
        Element header = new Element("header");
        header.setAttribute("creationtool", "Stingray");
        header.setAttribute("creationtoolversion", Constants.VERSION);
        header.setAttribute("datatype", "unknown");
        header.setAttribute("segtype", "block");
        header.setAttribute("adminlang", "en");
        header.setAttribute("srclang", "*all*");
        header.setAttribute("o-tmf", "XLIFF");
        root.addContent(header);
        Element body = new Element("body");
        root.addContent(body);

        long tuid = System.currentTimeMillis();
        int max = sources.size();
        if (targets.size() < max) {
            max = targets.size();
        }
        for (int i = 0; i < max; i++) {
            Element tu = new Element("tu");
            tu.setAttribute("tuid", "" + tuid++);
            body.addContent(tu);

            Element stuv = new Element("tuv");
            stuv.setAttribute("xml:lang", srcLang.getCode());
            Element sseg = new Element("seg");
            sseg.setContent(getTmxContent(targets.get(i)));
            stuv.addContent(sseg);
            tu.addContent(stuv);

            Element ttuv = new Element("tuv");
            ttuv.setAttribute("xml:lang", tgtLang.getCode());
            Element tseg = new Element("seg");
            tseg.setContent(getTmxContent(targets.get(i)));
            ttuv.addContent(tseg);
            tu.addContent(ttuv);
        }

        XMLOutputter outputter = new XMLOutputter();
        outputter.preserveSpace(true);
        Indenter.indent(root, 2);
        try (FileOutputStream output = new FileOutputStream(tmxFile)) {
            outputter.output(tmx, output);
        }
    }

    private List<XMLNode> getTmxContent(Element element) {
        List<XMLNode> result = new ArrayList<>();
        List<XMLNode> nodes = element.getContent();
        Iterator<XMLNode> it = nodes.iterator();
        while (it.hasNext()) {
            XMLNode n = it.next();
            if (n.getNodeType() == XMLNode.TEXT_NODE) {
                result.add(n);
            }
            if (n.getNodeType() == XMLNode.ELEMENT_NODE) {
                Element e = (Element) n;
                if ("ph".equals(e.getName())) {
                    e.setAttributes(new ArrayList<>());
                    result.add(e);
                }
                if ("g".equals(e.getName())) {
                    result.add(new TextNode(getPureText(e)));
                }
            }
        }
        return result;
    }

    public void exportCSV(String csvFile) throws IOException {
        try (FileOutputStream stream = new FileOutputStream(csvFile);
                OutputStreamWriter cout = new OutputStreamWriter(stream, StandardCharsets.UTF_16LE)) {
            byte[] feff = { -1, -2 };
            stream.write(feff);
            StringBuilder langs = new StringBuilder();
            langs.append(srcLang.getCode());
            langs.append('\t');
            langs.append(tgtLang.getCode());
            langs.append('\n');
            cout.write(langs.toString());

            int max = sources.size();
            if (targets.size() < max) {
                max = targets.size();
            }
            for (int i = 0; i < max; i++) {
                StringBuilder line = new StringBuilder();
                line.append(getPureText(sources.get(i)).replace('\n', ' ').strip());
                line.append('\t');
                line.append(getPureText(targets.get(i)).replace('\n', ' ').strip());
                line.append('\n');
                cout.write(line.toString());
            }
        }
    }

	public void setLanguages(JSONObject json) throws JSONException, IOException {
        srcLang = LanguageUtils.getLanguage(json.getString("srcLang"));
        tgtLang = LanguageUtils.getLanguage(json.getString("tgtLang"));
	}

}