# Salesforce with AWS S3 integration 

It's possible to integrate Amazon S3 Simple storage service and Webviewer in Salesforce for custom file management and documents viewing. This would allow Salesforce users to upload files larger than the native limit of Salesforce.

Prerequisite:
1. AWS account
2. AWS credential
3. salesforce account

## Add custom label
Custom labels are custom text values that can be accessed from Apex classes and Lightning components. It's a proper place to store the access key id and secret key of AWS.

## Update S3 bucket CORS policy
By default, actions of uploading/deleting/getting files are blocked by s3 bucket. You will need to allow "GET", "POST", and "DELETE" methods in the bucket's CORS policy,

## Set up S3 File List Component 

1. Clone the repository at: https://github.com/PDFTron/salesforce-s3-integration
2. Upload the _aws-sdk.min.js_ file in the root folder to your Salesforce's static resources.
3. Deploy the force-app to your salesforce website.
4. Click the setting button on the right, and click "Edit Page".
5. Drag the "S3 Files List" component from the "custom" section to the page.
6. Click the "Save" button and you should be able to see the file list component on the page.

* The Files List component make a reqeust whenever listing all the folders and files at the each file path (such as /bucket/folder), as well as adding or deleting the files in the bucket. It would make quite an amount of requests when taking actions, so please make sure you have a adaquate pla