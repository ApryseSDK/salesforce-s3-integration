public class AWSS3PutDriver implements Queueable, Database.AllowsCallouts {
    public Set<Id> contentVersionIdsSet;
    public AWSS3PutDriver(Set<Id> contentVersionIdsSet){
        this.contentVersionIdsSet = contentVersionIdsSet;
    }
    public void execute(QueueableContext context) {
        For(Id id : contentVersionIdsSet){
            AWSS3_PutAttachments putAttachment = new AWSS3_PutAttachments();
            putAttachment.recordId = Id;
            putAttachment.init();
        }     
    }
}