import S3 from 'aws-sdk/clients/s3';
import { GraaspS3FileItemOptions } from 'graasp-plugin-s3-file-item';
import { Sharp } from 'sharp';
import FileOperations from './FileOperations';
import { mimetype, sizes_names } from '../utils/constants';
import { createS3Key } from '../utils/helpers';
import contentDisposition from 'content-disposition';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

export class S3Provider implements FileOperations {
  private readonly options: GraaspS3FileItemOptions;
  private readonly prefix: string;
  private readonly s3Instance: S3;

  constructor(options: GraaspS3FileItemOptions, prefix: string) {
    this.options = options;
    this.prefix = prefix;

    const {
      s3Region: region,
      s3AccessKeyId: accessKeyId,
      s3SecretAccessKey: secretAccessKey,
      s3UseAccelerateEndpoint: useAccelerateEndpoint = false,
      s3Instance,
    } = options;

    this.s3Instance =
      s3Instance ??
      new S3({
        region,
        useAccelerateEndpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
  }

  async getObject({ key }: { key: string }): Promise<Buffer> {
    const { s3Bucket: bucket } = this.options;

    const params = {
      Bucket: bucket,
      Key: key,
    };
    return (await this.s3Instance.getObject(params).promise()).Body as Buffer;
  }

  async getObjectUrl({ reply, pluginStoragePrefix, id, size }) {
    const { s3Bucket: Bucket } = this.options;
    const key = createS3Key(pluginStoragePrefix, id, size);
    try {
      // check whether thumbnail exists
      await this.s3Instance.headObject({ Bucket, Key: key }).promise();
      // return key
      // todo: return image stream directly?
      reply.send({ key }).status(StatusCodes.OK);
    } catch (e) {
      // todo: check error
      reply.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
    }
  }

  async copyObject({
    originalId,
    newId,
    size,
    memberId,
  }: {
    originalId: string;
    newId: string;
    size: string;
    memberId: string;
  }): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    const params = {
      CopySource: `${bucket}/${createS3Key(this.prefix, originalId, size)}`,
      Bucket: bucket,
      Key: createS3Key(this.prefix, newId, size),
      Metadata: {
        member: memberId,
        item: newId,
      },
      MetadataDirective: 'REPLACE',
      ContentDisposition: contentDisposition(`thumb-${newId}-${size}`),
      ContentType: mimetype,
      CacheControl: 'no-cache', // TODO: improve?
    };

    // TODO: the Cache-Control policy metadata is lost. try to set a global policy for the bucket in aws.
    await this.s3Instance.getObject(params).promise();
  }

  async deleteItem({ id }: { id: string }): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    await Promise.all(
      sizes_names.map((size) =>
        this.s3Instance
          .deleteObject({
            Bucket: bucket,
            Key: createS3Key(this.prefix, id, size),
          })
          .promise(),
      ),
    );
  }

  async putObject({
    id,
    object,
    size,
    memberId,
  }: {
    id: string;
    object: Sharp;
    size: string;
    memberId: string;
  }): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    const params = {
      Bucket: bucket,
      Key: createS3Key(this.prefix, id, size),
      Metadata: {
        member: memberId,
        item: id,
      },
      Body: await object.toBuffer(),
      ContentType: mimetype,
      CacheControl: 'no-cache', // TODO: improve?
    };

    await this.s3Instance.putObject(params).promise();
  }
}