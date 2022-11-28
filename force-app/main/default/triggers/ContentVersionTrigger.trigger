trigger ContentVersionTrigger on ContentVersion (after insert) {
    System.debug('Hello World!');
    // // Call the handler Class
	ContentVersionTriggerHandler.createPublicLinkForFile(Trigger.New, Trigger.newMap);
}