import { LightningElement, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import targetFolderPrefix from '@salesforce/label/c.targetFolderPrefix';
import fileTypeIconMap from './fileTypeIconMap';
import BACKARROW_ICON from '@salesforce/resourceUrl/backArrowIcon';
import { fireEvent } from 'c/pubsub';
import { CurrentPageReference } from 'lightning/navigation';
import webviewerSupportedFormatMap from './webviewerSupportedFormatMap';
import helpers from './helpers/index';
// import custom labels
import AWS_SDK from '@salesforce/resourceUrl/awssdk'
import accessKeyId from '@salesforce/label/c.AWSAccessKeyId';
import secretAccessKey from '@salesforce/label/c.AWSSecretKey';
import region from '@salesforce/label/c.S3Region';
import bucketName from '@salesforce/label/c.S3BucketName';
import S3_Bucket_url from '@salesforce/label/c.S3_Bucket_url';

export default class Filelist extends LightningElement {
    @wire(CurrentPageReference) pageRef;
    s3Url = S3_Bucket_url
    s3 = "";
    files = false;
    currentPath = [];
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

    connectedCallback() {
        Promise.all([
            loadScript(this, AWS_SDK),
        ])
        .then(() => {
            this.initializeAWS();
            this.s3.listObjectsV2({
                Bucket: bucketName,
                Delimiter: "/"
            }, (err, data) => {
                if (err) return console.log(err);
                this.displayFilesFromS3Data(data);
                return console.log('success', data);
            })
        })
        .catch(err => {
            console.log(err);
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
        this.s3 = new window.AWS.S3({
            apiVersion: '2006-03-01',
            params: {
                Bucket: bucketName
            }
        });
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

    async uploadFile() {
        this.isUploadingFile = true;
        this.setUploadButtonAvailability();
        const params = {
            Body: this.fileToBeUploaded,
            Bucket: bucketName,
            Key: `${targetFolderPrefix}${this.fileToBeUploaded.name}`,
            ContentType: '*/*'
        }
        this.files = false;
        this.s3.putObject(params, (err, data) => {
            if (err) return console.log(err);
            this.fileToBeUploaded = null;
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
            if (err) console.log(err);
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
        const fileUrl = this.s3Url + itemKey;
        fireEvent(this.pageRef, 'openFileWithUrl', decodeURIComponent(fileUrl))
    }

    deleteFile() {
        this.files = false;
        this.s3.deleteObject({
            Bucket: this.bucketName,
            Key: this.fileToBeDeleted
        }, (err, data) => {
            if (err) console.log(err);
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
}