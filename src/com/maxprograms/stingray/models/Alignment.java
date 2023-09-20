/*******************************************************************************
 * Copyright (c) 2008 - 2023 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

package com.maxprograms.stingray.models;

import java.io.ByteArrayInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.xml.parsers.ParserConfigurationException;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.xml.sax.SAXException;

import com.maxprograms.languages.Language;
import com.maxprograms.languages.LanguageUtils;
import com.maxprograms.stingray.Constants;
import com.maxprograms.stingray.excel.ExcelWriter;
import com.maxprograms.stingray.excel.Sheet;
import com.maxprograms.xml.Document;
import com.maxprograms.xml.Element;
import com.maxprograms.xml.Indenter;
import com.maxprograms.xml.SAXBuilder;
import com.maxprograms.xml.TextNode;
import com.maxprograms.xml.XMLNode;
import com.maxprograms.xml.XMLOutputter;
import com.maxprograms.xml.XMLUtils;

public class Alignment {

    private String file;
    private Document doc;
    private List<Element> sources;
    private Language srcLang;
    private List<Element> targets;
    private Language tgtLang;

    private static Pattern pattern;
    private static String lastTarget;

    public Alignment(String source, String target) throws IOException, SAXException, ParserConfigurationException {
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
        sources = doc.getRootElement().getChild("sources").getChildren();
    }

    public void setTargets(List<Element> list) {
        List<XMLNode> content = new ArrayList<>();
        content.addAll(list);
        doc.getRootElement().getChild("targets").setContent(content);
        targets = doc.getRootElement().getChild("targets").getChildren();
    }

    public void save() throws IOException {
        setSources(sources);
        setTargets(targets);
        XMLOutputter outputter = new XMLOutputter();
        outputter.preserveSpace(true);
        Indenter.indent(doc.getRootElement(), 2);
        try (FileOutputStream out = new FileOutputStream(file)) {
            outputter.output(doc, out);
        }
    }

    public JSONObject getFileInfo() throws JSONException, SAXException, IOException, ParserConfigurationException {
        JSONObject result = new JSONObject();
        result.put("file", file);
        result.put("srcLang", jsonLang(srcLang));
        result.put("tgtLang", jsonLang(tgtLang));
        result.put("srcRows", sources.size());
        result.put("tgtRows", targets.size());
        return result;
    }

    private JSONObject jsonLang(Language lang)
            throws JSONException, SAXException, IOException, ParserConfigurationException {
        JSONObject result = new JSONObject();
        result.put("code", lang.getCode());
        result.put("description", lang.getDescription());
        result.put("bidi", lang.isBiDi());
        return result;
    }

    public JSONObject getRows(JSONObject json) throws SAXException, IOException, ParserConfigurationException {
        JSONObject result = new JSONObject();
        JSONArray rows = new JSONArray();
        int start = json.getInt("start");
        int count = json.getInt("count");
        for (int i = 0; i < count; i++) {
            int id = start + i;
            if (id >= sources.size() && id >= targets.size()) {
                break;
            }
            StringBuilder row = new StringBuilder();
            row.append("<tr id=\"");
            row.append("" + id);
            row.append("\"><td class='fixed initial'>");
            row.append(id + 1);
            row.append("</td><td");
            if (srcLang.isBiDi()) {
                row.append(" dir=\"rtl\"");
            }
            row.append(" class=\"cell initial\" lang=\"");
            row.append(srcLang.getCode());
            row.append("\">");
            row.append(getContent(sources, id));
            row.append("</td><td");
            if (tgtLang.isBiDi()) {
                row.append(" dir=\"rtl\"");
            }
            row.append(" class=\"cell\" lang=\"");
            row.append(tgtLang.getCode());
            row.append("\">");
            row.append(getContent(targets, id));
            row.append("</td></tr>");
            rows.put(row.toString());
        }
        result.put("rows", rows);
        result.put("srcRows", sources.size());
        result.put("tgtRows", targets.size());
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
                    result.append(pureText(e));
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
        return "<svg width=\"" + (width + 1)
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

    private Element trimSpaces(Element e) throws SAXException, IOException, ParserConfigurationException {
        SAXBuilder builder = new SAXBuilder();
        String text = "<source>" + extractText(e).strip() + "</source>";
        Element root1 = builder.build(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8))).getRootElement();
        e.setContent(root1.getContent());
        return e;
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

    public void exportTMX(String tmxFile) throws IOException, SAXException, ParserConfigurationException {
        Document tmx = new Document(null, "tmx", "-//LISA OSCAR:1998//DTD for Translation Memory eXchange//EN",
                "tmx14.dtd");
        Element root = tmx.getRootElement();
        root.setAttribute("version", "1.4");
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
            sseg.setContent(getTmxContent(trimSpaces(sources.get(i))));
            stuv.addContent(sseg);
            tu.addContent(stuv);

            Element ttuv = new Element("tuv");
            ttuv.setAttribute("xml:lang", tgtLang.getCode());
            Element tseg = new Element("seg");
            tseg.setContent(getTmxContent(trimSpaces(targets.get(i))));
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

    public void exportExcel(String excelFile) throws IOException, SAXException, ParserConfigurationException {
        int max = sources.size();
        if (targets.size() < max) {
            max = targets.size();
        }
        List<String> languages = new ArrayList<>();
        languages.add(srcLang.getCode());
        languages.add(tgtLang.getCode());
        Map<String, String> langsMap = new HashMap<>();
        Set<String> cols = new TreeSet<>();
        int i = 0;
        Iterator<String> it = languages.iterator();
        while (it.hasNext()) {
            String lang = it.next();
            char c = (char) (65 + i++);
            cols.add("" + c);
            langsMap.put(lang, "" + c);
        }

        List<Map<String, String>> rows = new ArrayList<>();

        Map<String, String> firstRow = new HashMap<>();
        firstRow.put(langsMap.get(srcLang.getCode()), srcLang.getCode());
        firstRow.put(langsMap.get(tgtLang.getCode()), tgtLang.getCode());
        rows.add(firstRow);

        for (i = 0; i < max; i++) {
            Map<String, String> rowMap = new HashMap<>();
            rowMap.put(langsMap.get(srcLang.getCode()), getPureText(sources.get(i)).replace('\t', ' '));
            rowMap.put(langsMap.get(tgtLang.getCode()), getPureText(targets.get(i)).replace('\t', ' '));
            rows.add(rowMap);
        }
        Sheet sheet = new Sheet("Sheet1", cols, rows);
        ExcelWriter writer = new ExcelWriter();
        writer.writeFile(excelFile, sheet);
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
                line.append(getPureText(sources.get(i)).replace('\t', ' ').replace('\n', ' ').strip());
                line.append('\t');
                line.append(getPureText(targets.get(i)).replace('\t', ' ').replace('\n', ' ').strip());
                line.append('\n');
                cout.write(line.toString());
            }
        }
    }

    public void setLanguages(JSONObject json)
            throws IOException, JSONException, SAXException, ParserConfigurationException {
        srcLang = LanguageUtils.getLanguage(json.getString("srcLang"));
        doc.getRootElement().getChild("sources").setAttribute("xml:lang", json.getString("srcLang"));
        tgtLang = LanguageUtils.getLanguage(json.getString("tgtLang"));
        doc.getRootElement().getChild("targets").setAttribute("xml:lang", json.getString("tgtLang"));
    }

    public void removeSegment(JSONObject json) {
        try {
            int row = Integer.parseInt(json.getString("id"));
            List<Element> list = sources;
            if (json.getString("lang").equals(tgtLang.getCode())) {
                list = targets;
            }
            list.remove(row);
        } catch (IndexOutOfBoundsException e) {
            Logger logger = System.getLogger(Alignment.class.getName());
            logger.log(Level.ERROR, e);
        }
    }

    public void segmentDown(JSONObject json) {
        try {
            int row = Integer.parseInt(json.getString("id"));
            List<Element> list = sources;
            if (json.getString("lang").equals(tgtLang.getCode())) {
                list = targets;
            }
            Element e = new Element("source");
            e.clone(list.get(row + 1));
            list.remove(row + 1);
            list.add(row, e);
        } catch (IndexOutOfBoundsException e) {
            // ignore
        }
    }

    public void segmentUp(JSONObject json) {
        try {
            int row = Integer.parseInt(json.getString("id"));
            List<Element> list = sources;
            if (json.getString("lang").equals(tgtLang.getCode())) {
                list = targets;
            }
            Element e = new Element("source");
            e.clone(list.get(row - 1));
            list.remove(row - 1);
            list.add(row, e);
        } catch (IndexOutOfBoundsException e) {
            // ignore
        }
    }

    public void mergeNext(JSONObject json) {
        try {
            int row = Integer.parseInt(json.getString("id"));
            List<Element> list = sources;
            if (json.getString("lang").equals(tgtLang.getCode())) {
                list = targets;
            }
            Element next = list.get(row + 1);
            list.get(row).addContent(next.getContent());
            list.remove(row + 1);
        } catch (IndexOutOfBoundsException e) {
            // ignore
        }
    }

    public void saveData(JSONObject json) throws SAXException, IOException, ParserConfigurationException {
        try {
            int row = Integer.parseInt(json.getString("id"));
            List<Element> list = sources;
            if (json.getString("lang").equals(tgtLang.getCode())) {
                list = targets;
            }
            String data = json.getString("data");
            if (data.indexOf("<svg") == -1) {
                list.get(row).setText(data);
            } else {
                Map<String, String> tagsMap = getTags(list.get(row));
                data = cleanSVG(data, tagsMap);
                list.get(row).clone(rebuild(data));
            }
        } catch (IndexOutOfBoundsException e) {
            // ignore
        }
    }

    public void splitSegment(JSONObject json) throws SAXException, IOException, ParserConfigurationException {
        try {
            int row = Integer.parseInt(json.getString("id"));
            List<Element> list = sources;
            if (json.getString("lang").equals(tgtLang.getCode())) {
                list = targets;
            }
            Map<String, String> tagsMap = getTags(list.get(row));
            String data = json.getString("start");
            if (data.indexOf("<svg") == -1) {
                list.get(row).setText(data);
            } else {
                data = cleanSVG(data, tagsMap);
                list.get(row).clone(rebuild(data));
            }
            data = json.getString("end");
            Element newSource = new Element("source");
            if (data.indexOf("<svg") == -1) {
                newSource.setText(data);
            } else {
                data = cleanSVG(data, tagsMap);
                newSource.clone(rebuild(data));
            }
            list.add(row + 1, newSource);
        } catch (IndexOutOfBoundsException e) {
            // ignore
        }
    }

    private Map<String, String> getTags(Element element) {
        Map<String, String> result = new HashMap<>();
        List<Element> children = element.getChildren("ph");
        Iterator<Element> it = children.iterator();
        int count = 1;
        while (it.hasNext()) {
            Element child = it.next();
            result.put("" + count++, child.toString());
        }
        return result;
    }

    private String cleanSVG(String data, Map<String, String> map)
            throws SAXException, IOException, ParserConfigurationException {
        SAXBuilder builder = new SAXBuilder();
        String text = "<source>" + data + "</source>";
        Element e = builder.build(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8))).getRootElement();
        StringBuilder sb = new StringBuilder();
        List<XMLNode> list = e.getContent();
        Iterator<XMLNode> it = list.iterator();
        int count = 1;
        while (it.hasNext()) {
            XMLNode node = it.next();
            if (node.getNodeType() == XMLNode.TEXT_NODE) {
                TextNode t = (TextNode) node;
                sb.append(t.getText());
            } else {
                sb.append(map.get("" + count++));
            }
        }
        return sb.toString();
    }

    private Element rebuild(String e) throws SAXException, IOException, ParserConfigurationException {
        SAXBuilder builder = new SAXBuilder();
        String text = "<source>" + e + "</source>";
        return builder.build(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8))).getRootElement();
    }

    public void replaceText(JSONObject json) {
        String search = json.getString("search");
        String replace = json.getString("replace");
        boolean regExp = json.getBoolean("regExp");
        List<Element> list = sources;
        if (!json.getBoolean("inSource")) {
            list = targets;
        }
        Iterator<Element> st = list.iterator();
        while (st.hasNext()) {
            Element element = st.next();
            List<XMLNode> newContent = new ArrayList<>();
            List<XMLNode> content = element.getContent();
            Iterator<XMLNode> it = content.iterator();
            while (it.hasNext()) {
                XMLNode node = it.next();
                if (node.getNodeType() == XMLNode.TEXT_NODE) {
                    TextNode text = (TextNode) node;
                    text.setText(replaceAll(text.getText(), search, replace, regExp));
                    newContent.add(text);
                }
                if (node.getNodeType() == XMLNode.ELEMENT_NODE) {
                    Element e = (Element) node;
                    String type = e.getName();
                    if (type.equals("g")) {
                        e.setText(replaceAll(e.getText(), search, replace, regExp));
                    }
                    newContent.add(node);
                }
            }
            element.setContent(newContent);
        }
    }

    public static String replaceAll(String string, String target, String replacement, boolean regExp) {
        String source = string;
        if (regExp) {
            if (pattern == null || !target.equals(lastTarget)) {
                pattern = Pattern.compile(target);
                lastTarget = target;
            }
            Matcher matcher = pattern.matcher(string);
            StringBuffer sb = new StringBuffer();
            while (matcher.find()) {
                matcher.appendReplacement(sb, replacement);
            }
            matcher.appendTail(sb);
            return sb.toString();
        }
        int start = source.indexOf(target);
        while (start != -1) {
            source = source.substring(0, start) + replacement + source.substring(start + target.length());
            start += replacement.length();
            start = source.indexOf(target, start);
        }
        return source;
    }

}