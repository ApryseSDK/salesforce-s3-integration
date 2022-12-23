export default function getFileTypeByFileName(fileName) {
    return fileName.split('.').pop();
}