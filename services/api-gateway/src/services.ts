
// What: Backward-compat shim file while refactoring to modular architecture
// Why: Preserve existing imports while new modules are introduced incrementally
// How: Re-export configs and pipeline helpers from their new locations

import { gatewayConfig, serviceRegistry, GATEWAY_LLD_DOC_PATH } from './config/gatewayConfig';
import { handleGatewayProxy } from './pipeline/handle';

export { gatewayConfig, serviceRegistry, GATEWAY_LLD_DOC_PATH, handleGatewayProxy };

/**
 * What: Shim export for gateway modules (config + pipeline)
 * Why: Maintain a stable import path during refactor; teach readers where to look next
 * How: Re-export from dedicated modules. See docs:
 *  - LLD: docs/design/gateway/LLD-APIGateway.md
 *  - TODO/PRD: services/api-gateway/TODO.md
 */
