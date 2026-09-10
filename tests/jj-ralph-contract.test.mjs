// Stable entry for all Ralph contracts. Child modules intentionally omit .test.mjs
// so node --test tests discovers this suite once.
import './ralph/assets.contract.mjs';
import './ralph/cli.contract.mjs';
import './ralph/gates.contract.mjs';
import './ralph/review.contract.mjs';
import './ralph/knowledge.contract.mjs';
import './ralph/lifecycle.contract.mjs';
import './ralph/migration.contract.mjs';
import './ralph/lite.contract.mjs';
import './ralph/conversation.contract.mjs';
import './ralph/context.contract.mjs';
