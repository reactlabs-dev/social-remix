#!/usr/bin/env tsx
import dotenv from 'dotenv';
import {
  S3Client,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
  GetBucketAclCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

// Load environment variables from .env.local first (if present), then fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const bucketArgIndex = args.findIndex((a) => a === '--bucket');
  const bucket = (bucketArgIndex !== -1 && args[bucketArgIndex + 1]) || process.env.AWS_S3_BUCKET || 'soluna-pmc-pdfs';

  if (!bucket) {
    console.error('[error] Bucket name is required. Pass --bucket <name> or set AWS_S3_BUCKET.');
    process.exit(1);
  }

  const region = process.env.AWS_REGION || 'us-east-2';
  const s3 = new S3Client({ region });

  interface PolicyStatusShape { IsPublic?: boolean }
  interface PublicAccessBlockShape {
    BlockPublicAcls?: boolean;
    BlockPublicPolicy?: boolean;
    IgnorePublicAcls?: boolean;
    RestrictPublicBuckets?: boolean;
  }
  interface AclShape {
    owner?: string;
    hasPublicGrant?: boolean;
    publicGrantPermission?: string | null;
    grantCount?: number;
  }
  interface ResultShape {
    bucket: string;
    region: string;
    exists?: boolean;
    error?: string;
    policyStatus?: PolicyStatusShape | { error: string };
    publicAccessBlock?: PublicAccessBlockShape | { error: string };
    acl?: AclShape | { error: string };
    derived?: {
      isPublicFromPolicy: boolean;
      isPublicFromAcl: boolean;
      publicAccessBlockRestrictive: boolean;
      likelyPublic: boolean;
    };
  }

  const result: ResultShape = { bucket, region };

  const isPolicyStatus = (v: unknown): v is PolicyStatusShape =>
    typeof v === 'object' && v !== null && 'IsPublic' in (v as Record<string, unknown>);
  const isAcl = (v: unknown): v is AclShape =>
    typeof v === 'object' && v !== null && 'hasPublicGrant' in (v as Record<string, unknown>);
  const isPab = (v: unknown): v is PublicAccessBlockShape =>
    typeof v === 'object' && v !== null &&
    ('BlockPublicAcls' in (v as Record<string, unknown>) ||
      'BlockPublicPolicy' in (v as Record<string, unknown>) ||
      'IgnorePublicAcls' in (v as Record<string, unknown>) ||
      'RestrictPublicBuckets' in (v as Record<string, unknown>));

  const errToMsg = (e: unknown): string => {
    const anyErr = e as { name?: string; code?: string; message?: string };
    return `${anyErr?.name || anyErr?.code || 'Unknown'} - ${anyErr?.message || String(e)}`;
  };

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    result.exists = true;
  } catch (e: unknown) {
    result.exists = false;
    result.error = `HeadBucket failed: ${errToMsg(e)}`;
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  try {
    const policyStatus = await s3.send(new GetBucketPolicyStatusCommand({ Bucket: bucket }));
    result.policyStatus = policyStatus?.PolicyStatus ?? undefined;
  } catch (e: unknown) {
    result.policyStatus = { error: errToMsg(e) };
  }

  try {
    const pab = await s3.send(new GetPublicAccessBlockCommand({ Bucket: bucket }));
    result.publicAccessBlock = pab?.PublicAccessBlockConfiguration ?? undefined;
  } catch (e: unknown) {
    result.publicAccessBlock = { error: errToMsg(e) };
  }

  try {
    const acl = await s3.send(new GetBucketAclCommand({ Bucket: bucket }));
    const grants = acl?.Grants || [];
    const publicGrant = grants.find(g => g.Grantee && (g.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' || g.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers'));
    result.acl = {
      owner: acl?.Owner?.DisplayName || acl?.Owner?.ID || 'unknown',
      hasPublicGrant: Boolean(publicGrant),
      publicGrantPermission: publicGrant?.Permission || null,
      grantCount: grants.length,
    };
  } catch (e: unknown) {
    result.acl = { error: errToMsg(e) };
  }

  // Derive a simple isPublic flag
  const isPublicFromPolicy = isPolicyStatus(result.policyStatus) && result.policyStatus.IsPublic === true;
  const isPublicFromAcl = isAcl(result.acl) && result.acl.hasPublicGrant === true;
  const pabCfg = isPab(result.publicAccessBlock) ? result.publicAccessBlock : undefined;
  const pabRestrictive = Boolean(
    pabCfg && (pabCfg.BlockPublicAcls || pabCfg.BlockPublicPolicy || pabCfg.IgnorePublicAcls || pabCfg.RestrictPublicBuckets)
  );

  result.derived = {
    isPublicFromPolicy,
    isPublicFromAcl,
    publicAccessBlockRestrictive: Boolean(pabRestrictive),
    likelyPublic: (isPublicFromPolicy || isPublicFromAcl) && !pabRestrictive,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
