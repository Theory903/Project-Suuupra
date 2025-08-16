import { moderationService } from '../../../src/services/moderation';

describe('ModerationService', () => {
  it('flags adult terms in text', () => {
    const result = moderationService.checkContent({
      // @ts-ignore minimal shape
      title: 'xxx tutorial', description: 'learn', tags: [], contentType: 'article', tenantId: 't', createdAt: new Date()
    } as any);
    expect(result.flags).toContain('adult_terms');
    expect(result.blocked).toBe(true);
  });

  it('flags suspicious extensions and large files', () => {
    const result = moderationService.checkContent({
      // @ts-ignore minimal shape
      title: 'Clean', description: 'desc', tags: [], contentType: 'article', tenantId: 't', createdAt: new Date(),
      fileInfo: { filename: 'evil.exe', contentType: 'application/octet-stream', fileSize: 6 * 1024 * 1024 * 1024, s3Key: 'k', checksumSha256: 'a', uploadedAt: new Date() }
    } as any);
    expect(result.flags).toEqual(expect.arrayContaining(['suspicious_extension', 'large_file']));
    expect(result.blocked).toBe(true);
  });
});

