// src/core/document/index.js

import DocumentManager from "./DocumentManager";
import DocumentLoader from "./DocumentLoader";
import DocumentValidator from "./DocumentValidator";
import DocumentInfo from "./DocumentInfo";
import DocumentSaver from "./DocumentSaver";
import DocumentCloser from "./DocumentCloser";
import DocumentSession from "./DocumentSession";
import TemplateRegistry from "./TemplateRegistry";

export {
    DocumentManager,
    DocumentLoader,
    DocumentValidator,
    DocumentInfo,
    DocumentSaver,
    DocumentCloser,
    DocumentSession,
    TemplateRegistry
};

export default DocumentManager;