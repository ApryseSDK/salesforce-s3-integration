public with sharing class PDFTron_S3FileRecordController {
    @AuraEnabled
    public static void insertNewFile(String fileName, String filePath) {
        // make sure not to insert duplicate record
        File__c[] files = new List<File__c> (
            [
                SELECT File__c.Name, File__c.S3_Path__c
                FROM File__c
                WHERE File__c.Name 
                = :fileName
            ]
        );
        Boolean fileExists = false;
        if (files.size() != 0) {
            for (File__c file : files) {
                if (file.S3_Path__c == filePath && file.Name == fileName) {
                    fileExists = true;
                }
            }
        }
        if (fileExists) {
            return;
        }
        File__c file = new File__c (
            Name = fileName,
            S3_Path__c = filePath 
        );
        upsert file;
    }

    @AuraEnabled
    public static File__c[] searchFileRecords(String input){
        try {
            String searchText = '%' + input + '%';
            File__c[] result = new List<File__c>(
                [
                    SELECT File__c.Name, File__c.S3_Path__c
                    FROM File__c
                    WHERE File__c.Name 
                    Like :searchText
                ]
            );
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteFileRecord(string filePath){
        try {
            File__c[] fileRecordToBeDeleted = new List<File__c> ([
                SELECT File__c.Name
                FROM File__c
                WHERE File__c.S3_Path__c
                = :filePath
            ]);
            delete fileRecordToBeDeleted;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
