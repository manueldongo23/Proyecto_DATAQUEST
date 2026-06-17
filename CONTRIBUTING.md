# Contributing to Normalization Quest Lab

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help foster a welcoming community

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork**: `git clone https://github.com/YOUR_USERNAME/normalization-quest-lab.git`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes** following the guidelines below
5. **Commit with clear messages**: `git commit -m "Add feature: description"`
6. **Push to your fork**: `git push origin feature/your-feature-name`
7. **Create a Pull Request** on the main repository

## Development Standards

### PHP/Laravel

- **PSR-12**: PHP Standard Recommendation style guide
- **Namespace**: Use appropriate namespaces for all classes
- **Type hints**: Always use return and parameter type hints
- **DocBlocks**: Include PHPDoc for public methods
- **Testing**: Write tests for new features

```php
<?php
namespace App\Domain\Services;

/**
 * Handles normalization operations
 */
class NormalizationEngine
{
    /**
     * Compute attribute closure
     * 
     * @param array<string> $attributes Initial attributes
     * @param array $fds Functional dependencies
     * @return array<string> Computed closure
     */
    public function computeClosure(array $attributes, array $fds): array
    {
        // Implementation
    }
}
```

### TypeScript/React

- **Naming**: PascalCase for components, camelCase for functions/variables
- **Props**: Define interfaces for all component props
- **Typing**: Avoid `any`, use specific types
- **Prettier**: Auto-format with Prettier

```typescript
import React, { FC } from 'react';

interface DiagnosisPanelProps {
  diagnosis: DidacticDiagnosis;
  onClose: () => void;
}

export const DiagnosisPanel: FC<DiagnosisPanelProps> = ({ 
  diagnosis, 
  onClose 
}) => {
  return (
    // JSX
  );
};
```

## Commit Message Guidelines

Format commits as: `<type>(<scope>): <subject>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

**Examples:**
```
feat(normalization): add BCNF violation detection
fix(api): handle empty functional dependencies
docs(readme): update installation instructions
style(frontend): format components with prettier
```

## Pull Request Process

1. **Description**: Clearly describe the changes and motivation
2. **Tests**: Include tests for new features
3. **Documentation**: Update docs for API/feature changes
4. **Changelog**: Update CHANGELOG.md if applicable
5. **Screenshots**: Include screenshots for UI changes
6. **No breaking changes**: Unless discussed in an issue first

### PR Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #(issue number)

## Testing Performed
Description of tests or manual testing done

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests written/updated
- [ ] Documentation updated
```

## Testing

### Backend Tests
```bash
# Run all tests
php artisan test

# Run specific test file
php artisan test tests/Feature/NormalizationTest.php

# Run with coverage
php artisan test --coverage
```

### Frontend Tests
```bash
cd frontend
npm test
npm test -- --coverage
```

### Manual Testing Checklist
- [ ] Backend API endpoints work
- [ ] Frontend loads without errors
- [ ] Schema validation works correctly
- [ ] Gamification features respond correctly
- [ ] Data persists across page refreshes
- [ ] Responsive design works on mobile

## Documentation

When adding new features, update:

1. **README.md**: Add feature to overview
2. **API_DOCUMENTATION.md**: Document new endpoints
3. **Code comments**: Explain complex logic
4. **CHANGELOG.md**: List changes in appropriate version

## Reporting Bugs

Create an issue with:

1. **Title**: Brief description
2. **Description**: What happened, what should happen
3. **Steps to reproduce**: Exact steps to reproduce
4. **Environment**: OS, browser, versions
5. **Screenshots**: Visual evidence if applicable
6. **Error logs**: Relevant error messages

**Example:**
```
Title: Schema validation fails with special characters

Description:
When I enter an attribute name with special characters,
the validation endpoint returns a 500 error.

Steps to Reproduce:
1. Open NormalizationQuestLab
2. Create attribute named "attr@name"
3. Click Validate
4. See error

Environment:
- OS: Windows 11
- Browser: Chrome 124
- Backend: Laravel 11

Error:
SQLSTATE[HY000]: General error: 1 no such table: schemas
```

## Feature Requests

Create an issue with:

1. **Title**: Brief feature description
2. **Motivation**: Why this feature is needed
3. **Proposed solution**: How it should work
4. **Alternative approaches**: Other solutions considered
5. **Example**: Code example or mockup if applicable

## Code Review

When reviewing PRs:

- Be constructive and respectful
- Suggest improvements, don't demand
- Ask for clarification if needed
- Approve once quality standards are met

## Areas for Contribution

### High Priority
- [ ] Additional normalization algorithms (4NF, 5NF)
- [ ] Performance optimizations for large schemas
- [ ] Mobile UI improvements
- [ ] Internationalization (i18n)

### Medium Priority
- [ ] Database tutorials
- [ ] Video content
- [ ] Example datasets
- [ ] Advanced analytics

### Community Help Needed
- [ ] Translation to other languages
- [ ] Tutorial writing
- [ ] Bug reporting
- [ ] Feature suggestions

## Development Workflow

### Setting Up Your Development Environment

```bash
# Install PHP development tools
composer global require phpstan/phpstan
composer global require squizlabs/php_codesniffer

# Install Node tools
npm install -g prettier eslint

# Pre-commit hooks (optional)
npm install -g husky
husky install
```

### Code Quality Checks

```bash
# PHP Analysis
phpstan analyse app

# Code style
./vendor/bin/pint

# Frontend linting
cd frontend && npm run lint
```

## Release Notes

When contributing, consider:

- Is this a breaking change?
- Does it affect the API?
- Is migration needed?
- Are there performance implications?

## Getting Support

- **Documentation**: Check README.md and docs/
- **Discussions**: Use GitHub Discussions
- **Issues**: Check existing issues first
- **Email**: contact@dataquest.com

## Thank You!

We appreciate your contributions to make Normalization Quest Lab better! 🙏

---

**Happy coding!** 💻
