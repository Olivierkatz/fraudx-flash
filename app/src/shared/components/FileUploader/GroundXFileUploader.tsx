import { useFileUploaderContext } from "@/contexts/FileUploaderContext";

import FileUploader, { FileUploaderProps } from "./FileUploader";

export type GroundXFileUploaderProps = Omit<FileUploaderProps, "onUploadFiles"> & {
  onUploadFiles?: FileUploaderProps["onUploadFiles"];
};

export function GroundXFileUploader({ onUploadFiles, onIngestStarted, ...props }: GroundXFileUploaderProps) {
  const { uploadFilesToGroundX } = useFileUploaderContext();

  return (
    <FileUploader
      {...props}
      onIngestStarted={onIngestStarted}
      onUploadFiles={
        onUploadFiles ??
        (async (items) => {
          const result = await uploadFilesToGroundX({
            bucketId: props.bucketId,
            files: items.map((item) => item.file),
            filter: props.filter,
            searchData: props.searchData,
            processLevel: props.processLevel,
          });
          return result;
        })
      }
    />
  );
}

export default GroundXFileUploader;
