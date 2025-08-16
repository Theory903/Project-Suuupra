import { IContent } from '@/models/Content';
import { ContextLogger } from '@/utils/logger';

export type ModerationFlag = 'suspicious_extension' | 'large_file' | 'adult_terms';

export interface ModerationResult {
  flags: ModerationFlag[];
  blocked: boolean;
  reasons: string[];
}

const ADULT_TERMS = ['xxx', 'porn', 'nude'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB safety threshold

export class ModerationService {
  private log = new ContextLogger({ service: 'moderation' });

  checkContent(content: IContent): ModerationResult {
    const flags: ModerationFlag[] = [];
    const reasons: string[] = [];

    // Basic text scan
    const text = `${content.title} ${content.description || ''}`.toLowerCase();
    if (ADULT_TERMS.some(t => text.includes(t))) {
      flags.push('adult_terms');
      reasons.push('Content text includes adult terms');
    }

    // File checks
    if (content.fileInfo) {
      const { filename, fileSize } = content.fileInfo;
      if (/\.(exe|bat|cmd|sh|js|msi)$/i.test(filename)) {
        flags.push('suspicious_extension');
        reasons.push('File extension potentially unsafe');
      }
      if (fileSize > MAX_SIZE_BYTES) {
        flags.push('large_file');
        reasons.push('File exceeds size threshold');
      }
    }

    const blocked = flags.length > 0;
    return { flags, blocked, reasons };
  }
}

export const moderationService = new ModerationService();

