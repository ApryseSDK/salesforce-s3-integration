import { LightningElement, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import AWS_SDK from '@salesforce/resourceUrl/awssdk'
import accessKeyId from '@salesforce/label/c.AWSAccessKeyId';
import secretAccessKey from '@salesforce/label/c.AWSSecretKey';
import region from '@salesforce/label/c.S3Region';
import bucketName from '@salesforce/label/c.S3FolderName';
import fileTypeIconMap from './fileTypeIconMap';
import BACKARROW_ICON from '@salesforce/resourceUrl/backArrowIcon';
import { fireEvent } from 'c/pubsub';
import { CurrentPageReference } from 'lightning/navigation';
import webviewerSupportedFormatMap from './webviewerSupportedFormatMap';

export default class Filelist extends LightningElement {
    s3Url = 'https://pdftron.s3.amazonaws.com/'
    @wire(CurrentPageReference) pageRef;
    s3 = "";
    files = false;
    filesRetrieved = false;
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
    filesToBeUploaded = [];
    uploadButtonAvailable = false;
    eventListenersAdded = false;
    isUploadingFile = false;

    connectedCallback() {
        console.log("connected call back")
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
                console.log(data);
                this.displayFilesFromS3Data(data);
                console.log(this.currentPath);
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
        console.log('regiser events');
        this.registerEvents();
        // this.setUploadButtonAvailability();
    }

    initializeAWS() {
        console.log('init aws');
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

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0? 0: decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    onFileInputChange(e) {
        console.log(e.target.files[0]);
        if (e.target.files.length) {
            this.fileToBeUploaded = e.target.files[0];
        }
    }

    getFileTypeFromFileName(fileName) {
        console.log('get file type', fileName);
        return fileName.split('.').pop();
    }

    async uploadFile() {
        console.log('start upload', this.currentPath);
        this.setUploadButtonAvailability();
        this.isUploadingFile = true;
        const binary = await this.getBinaryStringFromFile(this.fileToBeUploaded);
        const params = {
            Body: binary,
            Bucket: bucketName,
            Key: `custom/johnny/${this.fileToBeUploaded.name}`,
            ContentType: 'application/pdf'
        }
        this.files = false;
        console.log(params);
        this.s3.putObject(params, (err, data) => {
            if (err) return console.log(err);
            this.fileToBeUploaded = null;
            console.log('finished put new object', data);
            console.log('current path', this.currentPath);
            let folderPrefix = this.currentPath.join('/');
            console.log('upload folder prefix', folderPrefix)
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
        console.log('list objects In folder', folderPrefix);
        this.s3.listObjectsV2({
            Bucket: bucketName,
            Delimiter: "/", 
            Prefix: folderPrefix
        }, (err, data) => {
            if (err) console.log(err);
            console.log(data);
            this.displayFilesFromS3Data(data);
        });
    }

    onFolderClick(folderPrefix) {
        const folderPathArray = folderPrefix.split("/");
        folderPathArray.pop();
        console.log(folderPathArray);
        this.currentPath = folderPathArray;
        this.displayedCurrentPath = this.currentPath.join("/");
        console.log(this.currentPath);
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
                const fileType = this.getFileTypeFromFileName(item.Key);
                console.log(fileType);
                displayedItems.push({
                    Key: item.Key.replace(folderPrefix, ""),
                    FileSize: this.formatBytes(item.Size),
                    LastModifiedAt: item.LastModified.toString(),
                    Icon: fileTypeIconMap[this.getFileTypeFromFileName(item.Key).toUpperCase()],
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
        console.log('itemKey', itemKey)
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
            // folderPrefix = `/${folderPrefix}`;
            console.log('after delete folder prefix', folderPrefix);
            this.listObjectsInFolder(folderPrefix);
            console.log('list objects');
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
        console.log(this.filesToBeUploaded);
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
                    Key: `custom/johnny/${this.fileToBeUploaded.name}`,
                    ContentType: 'application/pdf'
                };
                this.s3.putObject({
                    
                })
            }))
        }
    }

    registerEvents = () => {
        const dropArea = this.template.querySelector('[data-id="upload-area"]');
        console.log('drop area', dropArea);
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, this.preventDefaults)
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, this.highlight);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, this.unhighlight);
        });

        dropArea.addEventListener('drop', this.handleDrop);
    }

    handleDrop = (e) => {
        let dt = e.dataTransfer.files;
        console.log('dt', dt);
        this.fileToBeUploaded = e.dataTransfer.files[0];
        this.setUploadButtonAvailability();
    }

    preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };


    highlight = (e) => {
        // this.dragZoneActive = true;
    };

    unhighlight = (e) => {
        // this.dragZoneActive = false;
    };

    setUploadButtonAvailability = () => {
        if (!this.fileToBeUploaded || this.isUploadingFile) {
            this.uploadButtonAvailable = false;
        } else {
            this.uploadButtonAvailable = true;
        }
    }
}