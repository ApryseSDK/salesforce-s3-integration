public class ContentVersionTriggerHandler {
    
    public static void createPublicLinkForFile(List<ContentVersion> contentVersionList, Map<Id, ContentVersion> contentVersionMap){
        // get the content document link
        Map<Id, ContentDocumentLink> contentDocumentLinkMap = getContentDocumentLinkMap(contentVersionList);
        System.debug(contentDocumentLinkMap);
        Set<Id> contentToBeUploaded = new Set<Id>();
        for(ContentVersion version : contentVersionList){
            ContentDocumentLink link = contentDocumentLinkMap.get( version.ContentDocumentId );
            System.debug(link);
            if( ( link.LinkedEntityId.getSObjectType() == Account.sObjectType) ){
                contentToBeUploaded.add(version.Id);
            }
        }
        AWSS3PutDriver driverClass = new AWSS3PutDriver(contentToBeUploaded);
        Id jobId = System.enqueueJob(driverClass);
    }
    
    // Get the Content Document Related to Cintent Version so that We can check which object is parent to file
	public static Map<Id, ContentDocumentLink> getContentDocumentLinkMap(List<ContentVersion> contentVersionList){
        Set<String> contentDocumentIdsSet = new Set<String>();
        for(ContentVersion version : contentVersionList){
            contentDocumentIdsSet.add(version.ContentDocumentId);
        }
        Map<Id, ContentDocumentLink> contentDocumentLinkMap = new Map<Id, ContentDocumentLink>();
        for(ContentDocumentLink link : [SELECT Id, LinkedEntityId, ContentDocumentId FROM ContentDocumentLink WHERE ContentDocumentId IN :contentDocumentIdsSet]){
            if(link.LinkedEntityId.getSObjectType() == Account.sObjectType){
                contentDocumentLinkMap.put(link.ContentDocumentId, link);
            }
        }
        return contentDocumentLinkMap;
    }
}