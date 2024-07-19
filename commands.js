import 'dotenv/config';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Simple test command
// const DND_COMMAND = {
//     name: 'dnd',
//     description: 'Ask a DnD question',
//     type: 1,
// };

// Command containing options
const DND_COMMAND = {
    name: 'dnd',
    description: 'Ask a DnD question',
    options: [
        {
            type: 3,
            name: 'question',
            description: 'The DnD question to ask',
            required: true,
        },
    ],
    type: 1,
};

const SW_COMMAND = {
    name: 'sw',
    description: 'Ask a Savage Worlds question',
    options: [
        {
            type: 3,
            name: 'question',
            description: 'The Savage Worlds question to ask',
            required: true,
        },
    ],
    type: 1,
};

const ALL_COMMANDS = [DND_COMMAND, SW_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);