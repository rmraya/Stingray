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
import java.util.List;

import javax.xml.parsers.ParserConfigurationException;

import com.maxprograms.xml.Document;
import com.maxprograms.xml.Element;
import com.maxprograms.xml.SAXBuilder;
import com.maxprograms.xml.XMLOutputter;

import org.xml.sax.SAXException;

public class Alignment {

    private String file;
    private Document doc;
    private List<Element> sources;
    private String srcLang;
    private List<Element> targets;
    private String tgtLang;

    public Alignment(String file) throws SAXException, IOException, ParserConfigurationException {
        this.file = file;
        SAXBuilder builder = new SAXBuilder();
        doc = builder.build(file);
        sources = doc.getRootElement().getChild("sources").getChildren();
        srcLang = doc.getRootElement().getChild("sources").getAttributeValue("xml:lang");
        targets = doc.getRootElement().getChild("targets").getChildren();
        tgtLang = doc.getRootElement().getChild("targets").getAttributeValue("xml:lang");
    }

    public void save() throws IOException {
        XMLOutputter outputter = new XMLOutputter();
        try (FileOutputStream out = new FileOutputStream(file)) {
            outputter.output(doc, out);
        }
    }
}