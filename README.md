# Stingray Document Aligner

![Stingray logo](icons/icon.png)

Stingray is a document aligner designed to assist professional translators in the production of translation memories from existing translated material.

Translation memories in TMX or TAB delimited format generated by Stingray can be used in most modern CAT (Computer Aided Translation) programs, including [Swordfish](https://www.maxprograms.com/products/swordfish.html).

TAB delimited files created by Stingray can be opened in Microsoft Excel or Apple Numbers without special configurations.

#### Align Two Word Files

- <a href="https://www.maxprograms.com/tutorials/AlignFiles.mp4">Click here to watch a Video</a>

## Licenses

Stingray is available in two modes:

- Source Code
- Yearly Subscriptions for installers and support

### Source Code

Source code of is free. Anyone can download the source code, compile, modify and use it at no cost in compliance with the accompanying [license terms](https://github.com/rmraya/Stingray/blob/master/LICENSE).

You can subscribe to [Maxprograms Support](https://groups.io/g/maxprograms/) at Groups.io and request peer assistance for the source code version there.

### Subscriptions

Ready to use installers and technical support for Stingray are available as yearly subscriptions at [Maxprograms Online Store](https://www.maxprograms.com/store/buy.html).

The version of Stingray included in the official installers from [Stingray's Home Page](https://www.maxprograms.com/products/stingray.html) can be used at no cost for 7 days requesting a free Evaluation Key.

Subscription Keys cannot be shared or transferred to a different machine.

Subscription version includes unlimited email support at <tech@maxprograms.com>

### Differences sumary

Differences | Source Code | Subscription Based
-|----------- | -------------
Ready To Use Installers| No | Yes
Notarized macOS launcher| No | Yes
Signed launcher and installer for Windows | No | Yes
Associate app with `.algn` extension | No | Yes
Restricted Features | None | None
Technical Support |  Peer support at  [Groups.io](https://groups.io/g/maxprograms/)| - Direct email at <tech@maxprograms.com>  <br> - Peer support at [Groups.io](https://groups.io/g/maxprograms/)

## Requirements

- JDK 21 or newer is required for compiling and building. Get it from [Adoptium](https://adoptium.net/).
- Apache Ant 1.10.14 or newer. Get it from [https://ant.apache.org/](https://ant.apache.org/)
- Node.js 22.13.0 LTS or newer. Get it from [https://nodejs.org/](https://nodejs.org/)

## Building

- Checkout this repository.
- Point your `JAVA_HOME` environment variable to JDK 21
- Run `ant` to compile the Java code
- Run `npm install` to download and install NodeJS dependencies
- Run `npm start` to launch Stingray

### Steps for building

``` bash
  git clone https://github.com/rmraya/Stingray.git
  cd Stingray
  ant
  npm install
  npm start
```

Compile once and then simply run `npm start` to start Stingray
