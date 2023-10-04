import { LightningElement, wire, track, api } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import fileTypeIconMap from './fileTypeIconMap';
import BACKARROW_ICON from '@salesforce/resourceUrl/backArrowIcon';
import { fireEvent } from 'c/pubsub';
import { CurrentPageReference } from 'lightning/navigation';
import webviewerSupportedFormatMap from './webviewerSupportedFormatMap';
import helpers from './helpers/index';
import insertNewFile from '@salesforce/apex/PDFTron_S3FileRecordController.insertNewFile';
import searchFileRecords from '@salesforce/apex/PDFTron_S3FileRecordController.searchFileRecords';
import deleteFileRecord from '@salesforce/apex/PDFTron_S3FileRecordController.deleteFileRecord';
import { publish, MessageContext } from 'lightning/messageService';
// import custom labels
import targetFolderPrefix from '@salesforce/label/c.targetFolderPrefix';
import AWS_SDK from '@salesforce/resourceUrl/awssdk'
import accessKeyId from '@salesforce/label/c.AWSAccessKeyId';
import secretAccessKey from '@salesforce/label/c.AWSSecretKey';
import region from '@salesforce/label/c.S3Region';
import bucketName from '@salesforce/label/c.S3BucketName';
import S3_Bucket_url from '@salesforce/label/c.S3_Bucket_url';

export default class Filelist extends LightningElement {
    @wire(CurrentPageReference) pageRef;
    @track file__c;
    @track error;
    s3Url = S3_Bucket_url
    s3 = "";
    files = false;
    textFiles = [];
    @api currentPath = [];
    displayedCurrentPath = "";
    columns = [
        {
            label: 'File Name',
            fieldName: 'Key'
        },
        {
            label: 'File Size',
            fieldName: 'FileSize'
        },
        {
            label: 'Last Modified',
            fieldName: 'LastModifiedAt'
        }
    ];
    retreivedFiles = false;
    backArrowIcon = `${BACKARROW_ICON}#backArrow`;
    fileToBeDeleted = null;
    deleteModalOpened = false;
    fileToBeUploaded = null;
    filesToBeUploaded = []; // could be used to develop files bulk uploading in the future
    uploadButtonAvailable = false;
    eventListenersAdded = false;
    isUploadingFile = false;
    searchKeyWord = "";

    connectedCallback() {
        Promise.all([
            loadScript(this, AWS_SDK),
        ])
        .then(() => {
            this.initializeAWS();
            this.s3.listObjectsV2({
                Bucket: bucketName,
                Delimiter: "/",
            }, (err, data) => {
                if (err) return console.error(err);
                this.displayFilesFromS3Data(data);
                return console.log('success', data);
            })
        })
        .catch(err => {
            console.error(err);
        })
    }

    renderedCallback() {
        if (this.eventListenersAdded) {
            return;
        }

        this.eventListenersAdded = true;
        this.registerEvents();
    }

    initializeAWS() {
        window.AWS.config.update({
            accessKeyId,
            secretAccessKey
        });
        window.AWS.config.region = region;
        const s3 = new window.AWS.S3({
            apiVersion: '2006-03-01',
            params: {
                Bucket: bucketName
            }
        });
        this.s3 = s3;
        window.s3 = s3;
    }

    onFileInputChange(e) {
        if (e.target.files.length) {
            this.fileToBeUploaded = e.target.files[0];
            this.setUploadButtonAvailability();
        }
    }

    getFileTypeFromFileName(fileName) {
        return fileName.split('.').pop();
    }

    async uploadFile(file) {
        this.isUploadingFile = true;
        this.setUploadButtonAvailability();
        const params = {
            Body: file,
            Bucket: bucketName,
            Key: `${targetFolderPrefix}${file.name}`,
            ContentType: '*/*'
        }
        this.files = false;
        this.s3.putObject(params, async (err, data) => {
            if (err) return console.error(err);
            await insertNewFile({
                fileName: file.name,
                filePath: `${targetFolderPrefix}${file.name}`
            })
            file = null;
            console.log(JSON.parse(JSON.stringify(this.currentPath)));
            let folderPrefix = this.currentPath.join('/');
            if (this.currentPath.length) {
                folderPrefix += '/';
            }
            this.isUploadingFile = false;
            this.setUploadButtonAvailability();
            this.listObjectsInFolder(folderPrefix);
            return null;
        })
    }

    handleUploadClick() {
        this.uploadFile(this.fileToBeUploaded).then(() => {console.log('success')}).catch((err) => {console.log(err)});
    }

    getBinaryStringFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result));
            reader.addEventListener('error', () => reject('error'));
            reader.readAsBinaryString(file);
        })
    }

    listObjectsInFolder(folderPrefix) {
        this.s3.listObjectsV2({
            Bucket: bucketName,
            Delimiter: "/", 
            Prefix: folderPrefix
        }, (err, data) => {
            if (err) console.error(err);
            this.displayFilesFromS3Data(data);
        });
    }

    onFolderClick(folderPrefix) {
        const folderPathArray = folderPrefix.split("/");
        folderPathArray.pop();
        this.currentPath = folderPathArray;
        this.displayedCurrentPath = this.currentPath.join("/");
        this.files = false;
        this.listObjectsInFolder(folderPrefix);
    }

    onBackClick() {
        this.files = false;
        this.currentPath.pop();
        let folderPrefix = this.currentPath.join('/');
        this.displayedCurrentPath = this.currentPath.join("/");
        if (this.currentPath.length) {
            folderPrefix = `${folderPrefix}/`
        }
        this.listObjectsInFolder(folderPrefix);
    }

    displayFilesFromS3Data(data) {
        let folderPrefix = this.currentPath.join('/');
        if (this.currentPath.length) {
            folderPrefix += '/';
        }
        let displayedItems = [];

        data.CommonPrefixes.forEach(item => displayedItems.push({
            Key: item.Prefix.replace(folderPrefix, "").replace("/", ""),
            LastModifiedAt: '-',
            FileSize: '',
            Icon: fileTypeIconMap.DIRECTORY,
            onclick: function() {
                return this.onFolderClick(item.Prefix)
            },
        }));
        data.Contents.forEach(item => {
            if (item.Size !== 0) {
                const fileType = helpers.getFileTypeByFileName(item.Key);
                displayedItems.push({
                    Key: item.Key.replace(folderPrefix, ""),
                    FileSize: helpers.formatBytes(item.Size),
                    LastModifiedAt: item.LastModified.toString(),
                    Icon: fileTypeIconMap[fileType.toUpperCase()],
                    // this will probably need a map in the future
                    CanOpenInWebviewer: webviewerSupportedFormatMap[fileType.toLowerCase()]? true : false,
                    // CanOpenInWebviewer: true,
                    onOpenClick: function() {
                        this.openFileInWebviewer(item.Key);
                    },
                    onDeleteClick: function() {
                        this.openDeleteModal(item.Key);
                    }
                });
            }
        });
        this.files = displayedItems;
    }

    openFileInWebviewer(itemKey) {
        const fileUrl = this.s3Url + '/' + itemKey;
        fireEvent(this.pageRef, 'openFileWithUrl', decodeURIComponent(fileUrl))
    }

    deleteFile() {
        this.files = false;
        this.s3.deleteObject({
            Bucket: this.bucketName,
            Key: this.fileToBeDeleted
        }, async (err, data) => {
            if (err) console.log(err);
            await deleteFileRecord({
                filePath: this.fileToBeDeleted
            });
            this.deleteModalOpened = false;
            let folderPrefix = this.currentPath.join('/') + '/';
            this.listObjectsInFolder(folderPrefix);
        })
    }

    openDeleteModal(itemKey) {
        this.deleteModalOpened = true;
        this.fileToBeDeleted = itemKey;
    }

    cancelDeleteModal() {
        this.deleteModalOpened = false;
        this.fileToBeDeleted = null;
    }

    onUpload(event) {
        const file = event.target.files[0];
        const currentSelectedFiles = [...this.filesToBeUploaded];
        currentSelectedFiles.push(file);
        this.filesToBeUploaded = currentSelectedFiles;
    }

    // this is for future improvement to upload multiple files at once
    uploadFiles() {
        const numberOfFilesToBeUploaded = this.filesToBeUploaded.length;
        const uploadPromises = [];
        for(let i = 0; i <numberOfFilesToBeUploaded; i++) {
            uploadPromises.push(new Promise(async (resolve, reject) => {
                const binary = await this.getBinaryStringFromFile(this.fileToBeUploaded);
                const params = {
                    Body: binary,
                    Bucket: bucketName,
                    Key: `${targetFolderPrefix}${this.fileToBeUploaded.name}`,
                    ContentType: 'application/pdf'
                };
                this.s3.putObject({
                    
                })
            }))
        }
    }

    registerEvents = () => {
        const dropArea = this.template.querySelector('[data-id="upload-area"]');
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, this.preventDefaults)
        });

        dropArea.addEventListener('drop', this.handleDrop);
    }

    handleDrop = (e) => {
        this.fileToBeUploaded = e.dataTransfer.files[0];
        this.setUploadButtonAvailability();
    }

    preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    setUploadButtonAvailability = () => {
        if (!this.fileToBeUploaded || this.isUploadingFile) {
            this.uploadButtonAvailable = false;
        } else {
            this.uploadButtonAvailable = true;
        }
    }

    onSearchInputChange(e) {
        this.searchKeyWord = e.target.value;
    }
    
    async searchFileRecords() {
        // const resp = await searchFileRecords({input: '1'});
        if (!this.searchKeyWord) {
            this.s3.listObjectsV2({
                Bucket: bucketName,
                Delimiter: "/",
            }, (err, data) => {
                if (err) return console.error(err);
                this.displayFilesFromS3Data(data);
                return console.log('success', data);
            });
            return;
        }
        this.files = false;
        const resp = await searchFileRecords({
            input: this.searchKeyWord
        });

        const searchedFiles = resp.map((file) => ({
            Key: file.Name,
            FileSize: '-',
            Icon: fileTypeIconMap[helpers.getFileTypeByFileName(file.Name).toUpperCase()],
            // this will probably need a map in the future
            CanOpenInWebviewer: webviewerSupportedFormatMap[helpers.getFileTypeByFileName(file.Name).toLowerCase()]? true : false,
            // CanOpenInWebviewer: true,
            onOpenClick: function() {
                this.openFileInWebviewer(file.S3_Path__c);
            },
            onDeleteClick: function() {
                this.openDeleteModal(file.S3_Path__c);
            }
        }));
        this.files = searchedFiles;
    }

    readFile(fileSource) {
        return new Promise((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.onerror = () => reject(fileReader.error);
          fileReader.onload = () => resolve(fileSource);
          fileReader.readAsDataURL(fileSource);
        });
    }
      
    async handleOnFileUpload (event) {
        this.textFiles = await Promise.all(
            [...event.target.files].map(file => this.readFile(file))
        );

        this.textFiles.forEach(file => {
            this.uploadFile(file).then(() => {console.log('success')}).catch((err) => {console.log(err)});
        })
    }
}   