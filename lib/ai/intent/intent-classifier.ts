import { Intent } from '../types';

export function classifyIntent(query: string): Intent {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('architecture') || 
      lowerQuery.includes('structure') ||
      lowerQuery.includes('design') ||
      lowerQuery.includes('how does it work') ||
      lowerQuery.includes('overview')) {
    return 'architecture';
  }

  if (lowerQuery.includes('auth') || 
      lowerQuery.includes('login') ||
      lowerQuery.includes('authentication') ||
      lowerQuery.includes('jwt') ||
      lowerQuery.includes('session') ||
      lowerQuery.includes('oauth')) {
    return 'explain-authentication';
  }

  if (lowerQuery.includes('api') || 
      lowerQuery.includes('endpoint') ||
      lowerQuery.includes('route') ||
      lowerQuery.includes('request') ||
      lowerQuery.includes('response')) {
    return 'explain-api';
  }

  if (lowerQuery.includes('database') || 
      lowerQuery.includes('db') ||
      lowerQuery.includes('query') ||
      lowerQuery.includes('model') ||
      lowerQuery.includes('schema') ||
      lowerQuery.includes('prisma')) {
    return 'explain-database';
  }

  if (lowerQuery.includes('interview') || 
      lowerQuery.includes('question') ||
      lowerQuery.includes('ask me') ||
      lowerQuery.includes('quiz')) {
    return 'interview-questions';
  }

  if (lowerQuery.includes('review') || 
      lowerQuery.includes('improve') ||
      lowerQuery.includes('better') ||
      lowerQuery.includes('suggestion')) {
    return 'code-review';
  }

  if (lowerQuery.includes('bug') || 
      lowerQuery.includes('error') ||
      lowerQuery.includes('fix') ||
      lowerQuery.includes('issue') ||
      lowerQuery.includes('problem')) {
    return 'find-bug';
  }

  if (lowerQuery.includes('explain') || 
      lowerQuery.includes('what does') ||
      lowerQuery.includes('how does') ||
      lowerQuery.includes('what is')) {
    return 'explain-code';
  }

  if (lowerQuery.includes('where') || 
      lowerQuery.includes('find') ||
      lowerQuery.includes('which file') ||
      lowerQuery.includes('which function')) {
    return 'repository-question';
  }

  return 'general-chat';
}
