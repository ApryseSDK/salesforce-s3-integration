public class AWSS3_PutAttachments extends AWS{
    
    public String fileName;
    public String folderName;
    public Blob fileBody;
    public String contentType;
    public Id recordId;
    
    public override void init() {
        
        ContentVersion versionData = [ SELECT Id, Title, FileExtension, ContentDocumentId, VersionData FROM ContentVersion Where Id =: recordId];
        System.debug(versionData);
        String Name = versionData.Title.substringBeforeLast('.');
        Name = Name.replaceAll(' ','');
        Name = Name.replaceAll('[^a-zA-Z0-9 -]', '');
        Name = Name.replaceAll('-','');
        
        folderName = System.Label.S3FolderName; 
        // this is not required but if you want to upload file to specific folder then create a folder inside S3 bucket 
        // and then put the name inside Folder
        fileName = Name;
        fileBody = versionData.VersionData;
        
        ContentType = versionData.FileExtension;
        endpoint = new Url(System.Label.S3_Bucket_Url);
        /*
        * Value for S3_Bucket_Url is - https://amit-salesforcetest.s3.amazonaws.com/
        * https - default
        * amit-salesforcetest - Name of the bucket in S3
        * s3 - Service Name
        * amazonaws.com - default value
        */ 
        if(String.isBlank(folderName)){
            resource = +this.fileName+'.'+versionData.FileExtension;
        }else{
            resource = this.folderName+'/'+this.fileName+'.'+contentType;
        }
        region = System.Label.S3Region; // Your Amazon Region my value is - us-east-1
        service = 's3';
        accessKey = System.Label.AWSAccessKeyId; //AWSAccessKeyId
        method = HttpMethod.XPUT;
        //  Remember to set "payload" here if you need to specify a body
        //  payload = Blob.valueOf('some-text-i-want-to-send');
        //  This method helps prevent leaking secret key, 
        //  as it is never serialized
        payload = this.fileBody;
        System.debug('this file body');
        // Call this method from Abstract Class "AWS"
        createSigningKey(System.Label.AWSSecretKey);  //AWSSecretKey
        
        If(!Test.isRunningTest()){
            // Call this method from Abstract Class "AWS"
            HttpRequest req = createRequest();
            System.debug('Req '+req);
            try{
                // Send the Request and get the response
                HttpResponse res = (new Http()).send(req);
                if(res.getStatusCode() == 200 || res.getStatusCode() == 201){
                    System.debug(' \n '+res.getBody());
                    String awsUrl = req.getEndpoint();
                    String imageURL = '<a href="'+awsUrl+'">'+versionData.Title+'</a>&nbsp;';
                }
            }catch(System.CalloutException ex){
                System.debug('call out exception');
                // catch the Exception here
            }
        }else{
            HttpResponse response;
            createRequest();
            response = new HttpResponse();
            response.setHeader('Content-type', 'application/json');
            response.setBody('');
            response.setStatusCode(200);
            getInteger();
        }
    }
}