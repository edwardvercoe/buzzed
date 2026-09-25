import './timer.css';
import { validateDurationParts } from './duration';

const form = document.querySelector<HTMLFormElement>('#timer-form');
const hoursInput = document.querySelector<HTMLInputElement>('#hours');
const minutesInput = document.querySelector<HTMLInputElement>('#minutes');
const errorElement = document.querySelector<HTMLParagraphElement>('#error');
const startButton = document.querySelector<HTMLButtonElement>('#start');
const cancelButton = document.querySelector<HTMLButtonElement>('#cancel');

if (!form || !hoursInput || !minutesInput || !errorElement || !startButton || !cancelButton) {
  throw new Error('Timer form failed to initialize.');
}

cancelButton.addEventListener('click', () => window.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorElement.textContent = '';

  const validation = validateDurationParts(hoursInput.value, minutesInput.value);
  if (!validation.ok) {
    errorElement.textContent = validation.error;
    return;
  }

  startButton.disabled = true;
  const result = await window.buzzed.submitDuration(validation.totalMinutes);
  if (!result.ok) {
    errorElement.textContent = result.error ?? 'Unable to start the timer.';
    startButton.disabled = false;
  }
});
