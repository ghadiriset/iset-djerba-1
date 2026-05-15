(function () {
  const container = document.querySelector('.chat-layout');
  if (!container) return;

  const currentUser = Number(container.dataset.currentUser);
  const activeContact = Number(container.dataset.activeContact);
  if (!currentUser || !activeContact) return;

  const socket = io();
  const form = document.getElementById('chatForm');
  const input = document.getElementById('messageInput');
  const messagesBox = document.getElementById('messages');

  socket.emit('join-room');

  function appendMessage(message) {
    const mine = Number(message.sender_id) === currentUser;
    const div = document.createElement('div');
    div.className = `message ${mine ? 'mine' : 'theirs'}`;
    const date = new Date(message.created_at || Date.now()).toLocaleString('fr-FR');
    div.innerHTML = `<p>${message.content}</p><span>${date}</span>`;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  socket.on('message-received', (message) => {
    const isCurrentConversation =
      (Number(message.sender_id) === activeContact && Number(message.receiver_id) === currentUser) ||
      (Number(message.sender_id) === currentUser && Number(message.receiver_id) === activeContact);

    if (isCurrentConversation) appendMessage(message);
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = input.value.trim();
      if (!content) return;
      socket.emit('private-message', {
        senderId: currentUser,
        receiverId: activeContact,
        content
      });
      input.value = '';
    });
  }
})();
