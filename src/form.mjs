export const validateForm = ({ name, email }) => {
  if (typeof name !== 'string' || typeof email !== 'string')
    return null;
  name = name.trim();
  email = email.trim();
  return name && name.length <= 100 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? { name, email } : null;
};

export const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
