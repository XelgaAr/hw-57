import { server } from '../server.mjs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import querystring from 'querystring';

describe('HTTP Server', () => {
  const PORT = 3000; // Використовуємо фіксований порт 3000
  
  // Допоміжна функція для виконання HTTP запитів
  const makeRequest = (method, path, data = null) => {
    return new Promise((resolve, reject) => {
      const options = {
        method,
        hostname: 'localhost',
        port: PORT,
        path,
        headers: {}
      };
      
      if (data && method === 'POST') {
        const postData = querystring.stringify(data);
        options.headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        };
      }
      
      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (data && method === 'POST') {
        req.write(querystring.stringify(data));
      }
      
      req.end();
    });
  };
  
  // Перевірка наявності заголовків безпеки
  const checkSecurityHeaders = (headers) => {
    expect(headers['content-type']).toBe('text/html; charset=utf-8');
    expect(headers['content-length']).toBeDefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
  };
  
  beforeAll(() => {
    // Створюємо спай для запобігання виводу логів під час тестів
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Сервер вже запущено на порту 3000 в файлі server.mjs
  });
  
  afterAll(() => {
    // Закриваємо сервер після тестів
    if (server && server.listening) {
      server.close();
    }
    vi.restoreAllMocks();
  });
  
  // Тестування GET маршрутів
  describe('GET Requests', () => {
    it('should serve the home page at /', async () => {
      const response = await makeRequest('GET', '/');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('<title>Home</title>');
      expect(response.body).toContain('<h1>Home</h1>');
      expect(response.body).toContain('<p>Welcome to the Home Page</p>');
      checkSecurityHeaders(response.headers);
    });
    
    it('should serve the about page at /about', async () => {
      const response = await makeRequest('GET', '/about');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('<title>About</title>');
      expect(response.body).toContain('<h1>About</h1>');
      expect(response.body).toContain('<p>Learn more about us</p>');
      checkSecurityHeaders(response.headers);
    });
    
    it('should serve the contact page at /contact', async () => {
      const response = await makeRequest('GET', '/contact');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('<title>Contact</title>');
      expect(response.body).toContain('<h1>Contact</h1>');
      expect(response.body).toContain('<p>Get in touch</p>');
      checkSecurityHeaders(response.headers);
    });
    
    it('should return 404 for non-existent routes', async () => {
      const response = await makeRequest('GET', '/nonexistent');
      
      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('Page Not Found');
      checkSecurityHeaders(response.headers);
    });
  });
  
  // Тестування POST маршрутів
  describe('POST Requests', () => {
    it('should handle form submission at /submit', async () => {
      const formData = {
        name: 'Test User',
        email: 'test@example.com'
      };
      
      const response = await makeRequest('POST', '/submit', formData);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('<h1>Form Submitted</h1>');
      expect(response.body).toContain(`Name: ${formData.name}`);
      expect(response.body).toContain(`Email: ${formData.email}`);
      checkSecurityHeaders(response.headers);
    });
    
    it('should return 400 for invalid form data', async () => {
      const formData = {
        name: '',
        email: ''
      };
      
      const response = await makeRequest('POST', '/submit', formData);
      
      expect(response.statusCode).toBe(400);
      expect(response.body).toContain('Invalid form data');
      checkSecurityHeaders(response.headers);
    });
    
    it('should return 404 for POST requests to non-existent routes', async () => {
      const response = await makeRequest('POST', '/nonexistent', { test: 'data' });
      
      expect(response.statusCode).toBe(404);
      checkSecurityHeaders(response.headers);
    });
    
    it('should return 500 when an error occurs during form processing', async () => {
      // Мокаємо querystring.parse щоб викинути помилку
      const originalParse = querystring.parse;
      querystring.parse = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      try {
        const response = await makeRequest('POST', '/submit', { test: 'data' });
        
        expect(response.statusCode).toBe(500);
        expect(response.body).toContain('Server Error');
        checkSecurityHeaders(response.headers);
      } finally {
        // Відновлюємо оригінальну функцію
        querystring.parse = originalParse;
      }
    });
  });
  
  // Тестування обробки помилок
  describe('Error Handling', () => {
    it('should return 405 for unsupported HTTP methods', async () => {
      const options = {
        method: 'PUT',
        hostname: 'localhost',
        port: PORT,
        path: '/'
      };
      
      const response = await new Promise((resolve) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data
            });
          });
        });
        
        req.end();
      });
      
      expect(response.statusCode).toBe(405);
      expect(response.body).toContain('Method Not Allowed');
      checkSecurityHeaders(response.headers);
    });
  });
});
