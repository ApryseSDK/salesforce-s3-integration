export default function retrieveFolderAndFileName(file) {
    const filePath = file.split('/').filter( x => x );
    // debugger;
    const fileName = filePath.pop();
    const folderPath = filePath.length < 1 ? '/' : '/' + filePath.join('/') + '/';
    const result = { fileName, folderPath };
    // debugger;
    return result;
}