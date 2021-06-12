/*******************************************************************************
 * Copyright (c) 2008-2021 Maxprograms.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/org/documents/epl-v10.html
 *
 * Contributors:
 *     Maxprograms - initial API and implementation
 *******************************************************************************/

module stingray {
	
	exports com.maxprograms.stingray;
	
	requires java.base;
	requires java.xml;
	requires transitive openxliff;
	requires transitive jdk.httpserver;
	requires transitive json;
	requires java.logging;
}