import { validateForm } from './form.mjs';

const form = document.querySelector('#contact-form');
form?.addEventListener('submit', event => {
  event.preventDefault();
  const data = validateForm(Object.fromEntries(new FormData(form)));
  const result = document.querySelector('#form-result');
  result.hidden = false;
  result.classList.toggle('error', !data);
  result.replaceChildren();
  for (const text of data ? ['Form Submitted', `Name: ${data.name}`, `Email: ${data.email}`, 'Браузерное демо: HTTP POST не выполнялся.'] : ['Invalid form data', 'Проверьте имя и адрес электронной почты.']) {
    const line = document.createElement('p');
    line.textContent = text;
    result.append(line);
  }
});
