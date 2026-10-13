// Independent of the animation boot: plain HTML addresses remain usable without JavaScript.
const resets = new WeakMap();
for (const button of document.querySelectorAll('.email-copy')) button.hidden = false;

document.addEventListener('click', async event => {
  const button = event.target.closest('.email-copy');
  if (!button || button.disabled) return;
  const contact = button.closest('.email-contact');
  const address = contact.querySelector('.email-address');
  const status = contact.querySelector('.email-status');
  clearTimeout(resets.get(button));
  button.disabled = true;
  status.textContent = '';
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(address.textContent.trim());
    button.textContent = 'COPIED';
    status.textContent = 'メールアドレスをコピーしました。';
  } catch {
    // No deprecated clipboard commands: select the visible text for the user's normal copy operation.
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(address);
      selection.removeAllRanges(); selection.addRange(range);
    }
    status.textContent = 'アドレスを選択し、手動でコピーしてください。';
  } finally {
    button.disabled = false;
  }
  resets.set(button, setTimeout(() => {
    button.textContent = 'COPY'; status.textContent = '';
  }, 3000));
});
