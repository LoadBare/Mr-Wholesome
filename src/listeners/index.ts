/*
 * Import all files that contain event listeners
 * to run them once so they begin listening
 * out for their respective event.
*/

// guild-member
import('./guild-member/guild-member-add.js');
import('./guild-member/guild-member-remove.js');
import('./guild-member/guild-member-update.js');

// message
import('./message/message-create.js');
import('./message/message-delete.js');
import('./message/message-update.js');

// role
import('./role/guild-role-create.js');
import('./role/guild-role-delete.js');
import('./role/guild-role-update.js');

// other
import('./interaction-create.js');
import('./ready.js');
