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
            name: 'dnd_question',
            description: 'The question to ask',
            required: true,
        },
    ],
    type: 1,
};

const ALL_COMMANDS = [DND_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);