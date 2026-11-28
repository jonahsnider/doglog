// Keep the S3 SDK out of Studio's startup bundle.
import {
	CompleteMultipartUploadCommand,
	CopyObjectCommand,
	CreateMultipartUploadCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	PutBucketCorsCommand,
	PutObjectCommand,
	S3Client,
	S3ServiceException,
	UploadPartCommand,
	paginateListObjectsV2,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpRequest } from '@smithy/core/protocols';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';

export default {
	CompleteMultipartUploadCommand,
	CopyObjectCommand,
	CreateMultipartUploadCommand,
	DeleteObjectCommand,
	FetchHttpHandler,
	GetObjectCommand,
	HttpRequest,
	PutBucketCorsCommand,
	PutObjectCommand,
	S3Client,
	S3ServiceException,
	UploadPartCommand,
	getSignedUrl,
	paginateListObjectsV2,
};
