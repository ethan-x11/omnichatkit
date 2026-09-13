# Contributing to OmniChatKit

First off, thank you for considering contributing to OmniChatKit!

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for OmniChatKit. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Check if the bug has already been reported** by searching on GitHub under Issues.
- **Provide a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps to reproduce the problem** in as many details as possible.
- **Provide specific examples to demonstrate the steps**. Include links to files or copy/paste snippets, which you use in those examples. If you're providing snippets in the issue, use Markdown code blocks.
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for OmniChatKit, including completely new features and minor improvements to existing functionality.

- **Check if there's already a package which provides that enhancement.**
- **Determine which repository the enhancement should be suggested in.**
- **Perform a cursory search** to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one.

### Pull Requests

The process described here has several goals:
- Maintain OmniChatKit's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible OmniChatKit
- Enable a sustainable system for OmniChatKit's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Make sure your code lints.
5. Issue that pull request!

## Development Setup

To contribute to OmniChatKit or build it locally:

```bash
# Clone the repository
git clone https://github.com/ethan-x11/omnichatkit.git
cd omnichatkit

# Install dependencies using Yarn (v4 is used in this project)
yarn install

# Run the development watcher
yarn dev

# Build the library (ESM, CJS, and Types)
yarn build

# Run typechecking
yarn lint
```

## Architecture and Stack

OmniChatKit is built using:
- **React 19+**
- **Tailwind CSS v4**
- **Zustand** for state management
- **Vercel AI SDK** & **AG-UI Protocol**

The project structure is as follows:
- `src/components/ui/` - Contains customized Shadcn/Radix components.
- `src/` - Core components, hooks, and logic.
- `dist/` - Compiled output after building.

## Styleguides

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for our commit messages. Please adhere to this format to keep the history clean and readable.

Examples:
- `feat: add new chat manager option`
- `fix: resolve issue with message streaming`
- `docs: update contributing guide`

### TypeScript Guidelines

- Use strict typing wherever possible.
- Avoid `any` unless absolutely necessary.
- Document complex logic and exported APIs using TSDoc comments.

Thank you for contributing!
