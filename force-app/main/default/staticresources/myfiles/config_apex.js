var resourceURL = '/resource/'
window.Core.forceBackendType('ems');

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
resourceURL = resourceURL + custom.namespacePrefix;

/**
 * The following `window.CoreControls.set*` functions point WebViewer to the
 * optimized source code specific for the Salesforce platform, to ensure the
 * uploaded files stay under the 5mb limit
 */
// office workers
window.Core.setOfficeWorkerPath(resourceURL + 'office')
window.Core.setOfficeAsmPath(resourceURL + 'office_asm');
window.Core.setOfficeResourcePath(resourceURL + 'office_resource');

// pdf workers
window.Core.setPDFResourcePath(resourceURL + 'resource')
if (custom.fullAPI) {
  window.Core.setPDFWorkerPath(resourceURL + 'pdf_full')
} else {
  window.Core.setPDFWorkerPath(resourceURL + 'pdf_lean')
}

// external 3rd party libraries
window.Core.setExternalPath(resourceURL + 'external')

// external 3rd party libraries
window.Core.setCustomFontURL('https://pdftron.s3.amazonaws.com/custom/ID-zJWLuhTffd3c/vlocity/webfontsv20/');

var global_document;



function _arrayBufferToBase64( buffer ) {
  var binary = '';
  var bytes = new Uint8Array( buffer );
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
      binary += String.fromCharCode( bytes[ i ] );
  }
  return window.btoa( binary );
}

async function generateBulkDocument(event){
  const autofillMap = event.data.results;
  

  console.log(autofillMap);
  const { blob, extension, filename, documentId } = global_document;
  const buffer = await blob.arrayBuffer();

  for(const e of autofillMap){
    console.log(e);

    let item = await Core.officeToPDFBuffer(buffer, {
      extension: extension,
      officeOptions: {
        templateValues: e 
      }});

    downloadFile(item, filename, extension)
    console.log(item);
  }

}

  const downloadFile = (buffer, fileName) => {
    const blob = new Blob([buffer]);
    const link = document.createElement('a');
  
    const file = fileName;
    // create a blobURI pointing to our Blob
    link.href = URL.createObjectURL(blob);
    link.download = file
    // some browser needs the anchor to be in the doc
    document.body.append(link);
    link.click();
    link.remove();
  
  
    parent.postMessage({ type: 'DOWNLOAD_DOCUMENT', file }, '*')
    // in case the Blob uses a lot of memory
    setTimeout(() => URL.revokeObjectURL(link.href), 7000);
    
  };

  // var applyPromise = MakeQuerablePromise(documentViewer.getDocument().applyTemplateValues(e))

  //   applyPromise.then(async function(){
  //     if(applyPromise.isFulfilled()) {
  //       await instance.downloadPdf();
  //       // await saveDocument(e.Id);
  //       console.log('Promise fulfilled');
  //     }
  //   })


// function MakeQuerablePromise(promise) {
//   // Don't modify any promise that has been already modified.
//   if (promise.isFulfilled) return promise;

//   // Set initial state
//   var isPending = true;
//   var isRejected = false;
//   var isFulfilled = false;

//   // Observe the promise, saving the fulfillment in a closure scope.
//   var result = promise.then(
//       function(v) {
//           isFulfilled = true;
//           isPending = false;
//           return v; 
//       }, 
//       function(e) {
//           isRejected = true;
//           isPending = false;
//           throw e; 
//       }
//   );

//   result.isFulfilled = function() { return isFulfilled; };
//   result.isPending = function() { return isPending; };
//   result.isRejected = function() { return isRejected; };
//   return result;
// }



async function saveDocument(recordId) {
  const doc = documentViewer.getDocument();
  if (!doc) {
    return;
  }
  instance.openElement('loadingModal');

  const fileType = doc.getType();
  const filename = doc.getFilename();
  const xfdfString = await instance.Core.documentViewer.getAnnotationManager().exportAnnotations();

  const data = await doc.getFileData({
    // Saves the document with annotations in it
    xfdfString,
    downloadType: 'pdf'
  });
  console.log('data', data);
  let binary = '';
  console.log('binary');
  const bytes = new Uint8Array(data);
  const blob = new Blob([bytes]);

  const payload = {
    title: filename.replace(/\.[^/.]+$/, ""),
    filename,
    blob,
  }
  // Post message to LWC
  parent.postMessage({ type: 'SAVE_DOCUMENT', payload }, '*');
}



window.addEventListener('viewerLoaded', async function () {
  /**
   * On keydown of either the button combination Ctrl+S or Cmd+S, invoke the
   * saveDocument function
   */
  instance.UI.hotkeys.on('ctrl+s, command+s', e => {
    e.preventDefault();
    saveDocument();
  });

  window.addEventListener('documentLoaded', async () => {
    const { documentViewer } = instance.Core;
    console.log('document loaded!');

    instance.UI.setLayoutMode(instance.UI.LayoutMode.FacingContinuous)

    await documentViewer.getDocument().documentCompletePromise();
    documentViewer.updateView();

    const doc = documentViewer.getDocument();
    const keys = await doc.getTemplateKeys();

    console.log("keys", keys);

    parent.postMessage({ type: 'DOC_KEYS', keys }, '*');
  })

  // Create a button, with a disk icon, to invoke the saveDocument function
  instance.UI.setHeaderItems(function (header) {
    var myCustomButton = {
      type: 'actionButton',
      dataElement: 'saveDocumentButton',
      title: 'tool.SaveDocument',
      img: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
      onClick: function () {
        saveDocument();
      }
    }
    header.get('viewControlsButton').insertBefore(myCustomButton);
  });
});

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event) {
  if (event.isTrusted && typeof event.data === 'object') {
    switch (event.data.type) {
      case 'OPEN_DOCUMENT_BLOB':
        const { blob, extension, filename, documentId } = event.data.payload;
        instance.UI.loadDocument(blob, { extension, filename, documentId });
        global_document = event.data.payload;
        break;
      case 'DOCUMENT_SAVED':
        instance.showErrorMessage('Document saved!')
        setTimeout(() => {
          instance.UI.closeElements(['errorModal', 'loadingModal'])
        }, 2000)
        break;
      case 'LMS_RECEIVED':
        /*  
        readerControl.showErrorMessage('Link received: ' + event.data.message);
        setTimeout(() => {
          readerControl.closeElements(['errorModal', 'loadingModal'])
        }, 2000)
        */
       
        instance.loadDocument(event.data.message, {
          filename: 'MyFile.pdf',
          withCredentials: false
        });
        
        break;
      case 'FILL_TEMPLATE':
        fillDocument(event);
        break;
      case 'BULK_TEMPLATE':
        generateBulkDocument(event);
        break;
      case 'CLOSE_DOCUMENT':
        console.log('close document');
        instance.UI.closeDocument()
        break;

      case 'OPEN_FILE_WITH_URL':
        const { fileUrl } = event.data.payload;
        console.log('OPEN_FILE_WITH_URL', fileUrl);
        instance.UI.loadDocument(fileUrl);
      default:
        break;
    }
  }
}
