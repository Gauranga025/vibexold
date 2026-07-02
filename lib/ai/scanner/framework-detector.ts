import { Framework } from '../types';

export function detectFramework(content: string): Framework {
  if (content.includes('import React') || content.includes('useState') || content.includes('useEffect')) {
    return 'React';
  }
  if (content.includes('import Vue') || content.includes('<template>') || content.includes('createApp')) {
    return 'Vue';
  }
  if (content.includes('@angular/') || content.includes('@Component') || content.includes('@Injectable')) {
    return 'Angular';
  }
  if (content.includes('next/') || content.includes('getServerSideProps') || content.includes('getStaticProps')) {
    return 'Next.js';
  }
  if (content.includes('express') || content.includes('app.get') || content.includes('app.post')) {
    return 'Express';
  }
  if (content.includes('django') || content.includes('from django') || content.includes('models.Model')) {
    return 'Django';
  }
  if (content.includes('flask') || content.includes('Flask') || content.includes('app.route')) {
    return 'Flask';
  }
  if (content.includes('fastapi') || content.includes('FastAPI') || content.includes('@app.')) {
    return 'FastAPI';
  }
  if (content.includes('spring') || content.includes('@SpringBootApplication') || content.includes('@RestController')) {
    return 'Spring';
  }

  return 'None';
}
