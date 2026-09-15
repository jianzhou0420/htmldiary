/* htmldiary — localized built-in templates and prompts (loaded from Settings on demand). */
'use strict';
const LOCAL_CONTENT = {};
LOCAL_CONTENT.en = { templates: [
  { id: 'daily', name: 'Daily Reflection', icon: '🌅', body: '# Daily Reflection\n\n**Highlights**\n- \n\n**What I learned**\n- \n\n**What I could do better**\n- \n\n**Tomorrow**\n- [ ] \n' },
  { id: 'gratitude', name: 'Gratitude', icon: '🙏', body: "# Three things I'm grateful for\n\n1. \n2. \n3. \n\n**Why they mattered today**\n\n" },
  { id: 'weekly', name: 'Weekly Review', icon: '📅', body: '# Weekly Review\n\n## Wins\n- \n\n## Struggles\n- \n\n## Lessons\n- \n\n## Next week\n- [ ] \n- [ ] \n- [ ] \n' },
  { id: 'travel', name: 'Travel Log', icon: '✈️', body: '# Travel Log\n\n**Where:** \n**With:** \n\n## What we did\n\n\n## Best moment\n\n\n## Food\n\n' },
  { id: 'dream', name: 'Dream Journal', icon: '🌙', body: '# Dream\n\n**Vividness:** /5\n\n**What happened**\n\n\n**Feelings on waking**\n\n' },
  { id: 'meeting', name: 'Meeting Notes', icon: '📝', body: '# Meeting\n\n**Attendees:** \n\n## Agenda\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] \n' },
], prompts: [
  'What made you smile today?', 'Describe a moment today you want to remember.', 'What is something you are looking forward to?', 'What is a small win you had this week?',
  'Who did you talk to today, and what did you learn from them?', 'What is worrying you right now, and what is one step you can take?', 'Write about a place that feels like home.',
  'What did you eat today that you enjoyed?', 'What would you tell yourself one year ago?', 'What is a habit you want to build, and why?', 'Describe your morning in detail.',
  'What is the best advice you have received recently?', 'What did you do today purely for yourself?', 'What is one thing you would change about today?', 'Write a letter to someone you miss.',
  'What are you proud of this month?', 'Describe the weather and how it affected your mood.', 'What is a question you keep coming back to?', 'What did you read, watch, or listen to recently that stuck with you?',
  'What is something you have been avoiding?', 'Who inspired you this week?', 'Write about a mistake that taught you something.', 'What does a perfect weekend look like?', 'What skill are you getting better at?',
  'What is a memory from childhood that surfaced recently?', 'Describe a conversation that changed your mind.', 'What did you notice today that you usually overlook?', 'What are you curious about lately?',
  'What was the hardest part of today?', 'What do you want more of in your life?', 'Describe a sound, smell, or texture from today.', 'What made today different from yesterday?',
] };
LOCAL_CONTENT['zh-CN'] = { templates: [
  { id: 'daily', name: '每日回顾', icon: '🌅', body: '# 每日回顾\n\n**今天的亮点**\n- \n\n**学到了什么**\n- \n\n**可以做得更好的**\n- \n\n**明天**\n- [ ] \n' },
  { id: 'gratitude', name: '感恩', icon: '🙏', body: '# 今天感谢的三件事\n\n1. \n2. \n3. \n\n**为什么它们重要**\n\n' },
  { id: 'weekly', name: '每周复盘', icon: '📅', body: '# 每周复盘\n\n## 做成的事\n- \n\n## 遇到的困难\n- \n\n## 教训\n- \n\n## 下周\n- [ ] \n- [ ] \n- [ ] \n' },
  { id: 'travel', name: '旅行记录', icon: '✈️', body: '# 旅行记录\n\n**地点：** \n**同行：** \n\n## 做了什么\n\n\n## 最好的时刻\n\n\n## 吃了什么\n\n' },
  { id: 'dream', name: '梦境', icon: '🌙', body: '# 梦\n\n**清晰度：** /5\n\n**梦到了什么**\n\n\n**醒来的感受**\n\n' },
  { id: 'meeting', name: '会议记录', icon: '📝', body: '# 会议\n\n**参会：** \n\n## 议程\n- \n\n## 决定\n- \n\n## 待办\n- [ ] \n' },
], prompts: [
  '今天什么让你笑了？', '描述今天一个你想记住的瞬间。', '你最近在期待什么？', '这周有什么小小的胜利？', '今天和谁聊了天，从他们那里学到了什么？',
  '现在让你担心的是什么？可以先做哪一步？', '写写一个让你觉得像家的地方。', '今天吃到了什么好吃的？', '你想对一年前的自己说什么？', '你想养成什么习惯，为什么？',
  '详细描述一下你的早晨。', '最近收到的最好的建议是什么？', '今天有没有纯粹为自己做的事？', '如果能改变今天的一件事，会是什么？', '给一个你想念的人写封信。',
  '这个月你为什么感到骄傲？', '描述今天的天气，以及它对心情的影响。', '有什么问题是你反复想起的？', '最近读到、看到或听到的什么东西一直留在心里？', '你一直在回避什么？',
  '这周谁给了你启发？', '写一个教会你东西的错误。', '完美的周末是什么样的？', '你在哪项技能上正在进步？', '最近有哪段童年记忆浮现出来？',
  '描述一次改变你想法的对话。', '今天注意到了什么平时会忽略的东西？', '最近对什么感到好奇？', '今天最难的部分是什么？', '你希望生活里多一些什么？',
  '描述今天的一种声音、气味或触感。', '今天和昨天有什么不同？',
] };
LOCAL_CONTENT['zh-TW'] = { templates: [
  { id: 'daily', name: '每日回顧', icon: '🌅', body: '# 每日回顧\n\n**今天的亮點**\n- \n\n**學到了什麼**\n- \n\n**可以做得更好的**\n- \n\n**明天**\n- [ ] \n' },
  { id: 'gratitude', name: '感恩', icon: '🙏', body: '# 今天感謝的三件事\n\n1. \n2. \n3. \n\n**為什麼它們重要**\n\n' },
  { id: 'weekly', name: '每週回顧', icon: '📅', body: '# 每週回顧\n\n## 做成的事\n- \n\n## 遇到的困難\n- \n\n## 教訓\n- \n\n## 下週\n- [ ] \n- [ ] \n- [ ] \n' },
  { id: 'travel', name: '旅行紀錄', icon: '✈️', body: '# 旅行紀錄\n\n**地點：** \n**同行：** \n\n## 做了什麼\n\n\n## 最好的時刻\n\n\n## 吃了什麼\n\n' },
  { id: 'dream', name: '夢境', icon: '🌙', body: '# 夢\n\n**清晰度：** /5\n\n**夢到了什麼**\n\n\n**醒來的感受**\n\n' },
  { id: 'meeting', name: '會議紀錄', icon: '📝', body: '# 會議\n\n**與會：** \n\n## 議程\n- \n\n## 決定\n- \n\n## 待辦\n- [ ] \n' },
], prompts: [
  '今天什麼讓你笑了？', '描述今天一個你想記住的瞬間。', '你最近在期待什麼？', '這週有什麼小小的勝利？', '今天和誰聊了天，從他們那裡學到了什麼？',
  '現在讓你擔心的是什麼？可以先做哪一步？', '寫寫一個讓你覺得像家的地方。', '今天吃到了什麼好吃的？', '你想對一年前的自己說什麼？', '你想養成什麼習慣，為什麼？',
  '詳細描述一下你的早晨。', '最近收到的最好的建議是什麼？', '今天有沒有純粹為自己做的事？', '如果能改變今天的一件事，會是什麼？', '給一個你想念的人寫封信。',
  '這個月你為什麼感到驕傲？', '描述今天的天氣，以及它對心情的影響。', '有什麼問題是你反覆想起的？', '最近讀到、看到或聽到的什麼東西一直留在心裡？', '你一直在迴避什麼？',
  '這週誰給了你啟發？', '寫一個教會你東西的錯誤。', '完美的週末是什麼樣的？', '你在哪項技能上正在進步？', '最近有哪段童年記憶浮現出來？',
  '描述一次改變你想法的對話。', '今天注意到了什麼平時會忽略的東西？', '最近對什麼感到好奇？', '今天最難的部分是什麼？', '你希望生活裡多一些什麼？',
  '描述今天的一種聲音、氣味或觸感。', '今天和昨天有什麼不同？',
] };
LOCAL_CONTENT.ja = { templates: [
  { id: 'daily', name: '一日のふり返り', icon: '🌅', body: '# 一日のふり返り\n\n**今日のハイライト**\n- \n\n**学んだこと**\n- \n\n**もっとよくできたこと**\n- \n\n**明日**\n- [ ] \n' },
  { id: 'gratitude', name: '感謝', icon: '🙏', body: '# 今日感謝している三つのこと\n\n1. \n2. \n3. \n\n**なぜ大切だったか**\n\n' },
  { id: 'weekly', name: '週のふり返り', icon: '📅', body: '# 週のふり返り\n\n## うまくいったこと\n- \n\n## 苦労したこと\n- \n\n## 教訓\n- \n\n## 来週\n- [ ] \n- [ ] \n- [ ] \n' },
  { id: 'travel', name: '旅行記', icon: '✈️', body: '# 旅行記\n\n**場所:** \n**同行者:** \n\n## したこと\n\n\n## 最高の瞬間\n\n\n## 食べたもの\n\n' },
  { id: 'dream', name: '夢日記', icon: '🌙', body: '# 夢\n\n**鮮明さ:** /5\n\n**何が起きたか**\n\n\n**目覚めたときの気持ち**\n\n' },
  { id: 'meeting', name: '会議メモ', icon: '📝', body: '# 会議\n\n**参加者:** \n\n## 議題\n- \n\n## 決定事項\n- \n\n## アクション\n- [ ] \n' },
], prompts: [
  '今日、何に笑顔になりましたか？', '今日、覚えておきたい瞬間を描写してください。', '楽しみにしていることは何ですか？', '今週の小さな勝利は？', '今日誰と話し、その人から何を学びましたか？',
  '今、不安なことは何ですか？まず一歩できることは？', '「家」のように感じる場所について書いてください。', '今日食べて嬉しかったものは？', '一年前の自分に何を伝えますか？', '身につけたい習慣とその理由は？',
  '今朝の様子を詳しく描写してください。', '最近もらった一番良い助言は？', '今日、自分のためだけにしたことは？', '今日を一つ変えられるとしたら？', '会いたい人に手紙を書いてください。',
  '今月、誇りに思うことは？', '今日の天気と、それが気分に与えた影響を書いてください。', '何度も考えてしまう問いは？', '最近読んだ・観た・聴いたもので心に残ったものは？', '避けていることは何ですか？',
  '今週、誰に刺激を受けましたか？', '何かを教えてくれた失敗について書いてください。', '完璧な週末とは？', '上達しているスキルは？', '最近よみがえった子どもの頃の記憶は？',
  '考えを変えた会話について書いてください。', '今日、普段見過ごしていることに気づきましたか？', '最近、何に好奇心を感じますか？', '今日一番大変だったことは？', '人生にもっと欲しいものは？',
  '今日の音、匂い、手触りを一つ描写してください。', '今日と昨日の違いは何でしたか？',
] };
LOCAL_CONTENT.ko = { templates: [
  { id: 'daily', name: '하루 돌아보기', icon: '🌅', body: '# 하루 돌아보기\n\n**오늘의 하이라이트**\n- \n\n**배운 것**\n- \n\n**더 잘할 수 있었던 것**\n- \n\n**내일**\n- [ ] \n' },
  { id: 'gratitude', name: '감사', icon: '🙏', body: '# 오늘 감사한 세 가지\n\n1. \n2. \n3. \n\n**왜 중요했나**\n\n' },
  { id: 'weekly', name: '주간 회고', icon: '📅', body: '# 주간 회고\n\n## 잘한 것\n- \n\n## 힘들었던 것\n- \n\n## 교훈\n- \n\n## 다음 주\n- [ ] \n- [ ] \n- [ ] \n' },
  { id: 'travel', name: '여행 기록', icon: '✈️', body: '# 여행 기록\n\n**어디:** \n**누구와:** \n\n## 한 일\n\n\n## 최고의 순간\n\n\n## 음식\n\n' },
  { id: 'dream', name: '꿈 일기', icon: '🌙', body: '# 꿈\n\n**선명도:** /5\n\n**무슨 일이 있었나**\n\n\n**깨어났을 때의 기분**\n\n' },
  { id: 'meeting', name: '회의 기록', icon: '📝', body: '# 회의\n\n**참석자:** \n\n## 안건\n- \n\n## 결정\n- \n\n## 할 일\n- [ ] \n' },
], prompts: [
  '오늘 무엇이 당신을 웃게 했나요?', '오늘 기억하고 싶은 순간을 묘사해 보세요.', '요즘 기대하는 일은 무엇인가요?', '이번 주의 작은 승리는?', '오늘 누구와 이야기했고 무엇을 배웠나요?',
  '지금 걱정되는 것은 무엇이고, 먼저 할 수 있는 한 걸음은?', '집처럼 느껴지는 장소에 대해 써 보세요.', '오늘 맛있게 먹은 것은?', '1년 전의 나에게 무슨 말을 해 주고 싶나요?', '만들고 싶은 습관과 그 이유는?',
  '오늘 아침을 자세히 묘사해 보세요.', '최근 받은 가장 좋은 조언은?', '오늘 오롯이 나를 위해 한 일은?', '오늘 하나를 바꿀 수 있다면?', '그리운 사람에게 편지를 써 보세요.',
  '이번 달 자랑스러운 것은?', '오늘 날씨와 그것이 기분에 미친 영향을 써 보세요.', '자꾸 돌아오게 되는 질문은?', '최근 읽거나 보거나 들은 것 중 마음에 남은 것은?', '피하고 있는 것은 무엇인가요?',
  '이번 주 누가 영감을 주었나요?', '무언가를 가르쳐 준 실수에 대해 써 보세요.', '완벽한 주말은 어떤 모습인가요?', '점점 나아지고 있는 기술은?', '최근 떠오른 어린 시절의 기억은?',
  '생각을 바꾼 대화를 묘사해 보세요.', '오늘 평소에 지나치던 것 중 무엇을 알아챘나요?', '요즘 무엇이 궁금한가요?', '오늘 가장 힘들었던 부분은?', '삶에서 더 원하는 것은?',
  '오늘의 소리, 냄새, 촉감 하나를 묘사해 보세요.', '오늘은 어제와 무엇이 달랐나요?',
] };
LOCAL_CONTENT.vi = { templates: [
  { id: 'daily', name: 'Nhìn lại một ngày', icon: '🌅', body: '# Nhìn lại một ngày\n\n**Điểm sáng**\n- \n\n**Điều học được**\n- \n\n**Điều có thể làm tốt hơn**\n- \n\n**Ngày mai**\n- [ ] \n' },
  { id: 'gratitude', name: 'Biết ơn', icon: '🙏', body: '# Ba điều tôi biết ơn hôm nay\n\n1. \n2. \n3. \n\n**Vì sao chúng quan trọng**\n\n' },
  { id: 'weekly', name: 'Tổng kết tuần', icon: '📅', body: '# Tổng kết tuần\n\n## Thành công\n- \n\n## Khó khăn\n- \n\n## Bài học\n- \n\n## Tuần tới\n- [ ] \n- [ ] \n- [ ] \n' },
  { id: 'travel', name: 'Nhật ký du lịch', icon: '✈️', body: '# Nhật ký du lịch\n\n**Ở đâu:** \n**Với ai:** \n\n## Đã làm gì\n\n\n## Khoảnh khắc đẹp nhất\n\n\n## Ẩm thực\n\n' },
  { id: 'dream', name: 'Nhật ký giấc mơ', icon: '🌙', body: '# Giấc mơ\n\n**Độ rõ:** /5\n\n**Chuyện gì đã xảy ra**\n\n\n**Cảm giác khi tỉnh dậy**\n\n' },
  { id: 'meeting', name: 'Ghi chú cuộc họp', icon: '📝', body: '# Cuộc họp\n\n**Người tham dự:** \n\n## Nội dung\n- \n\n## Quyết định\n- \n\n## Việc cần làm\n- [ ] \n' },
], prompts: [
  'Điều gì khiến bạn mỉm cười hôm nay?', 'Mô tả một khoảnh khắc hôm nay bạn muốn ghi nhớ.', 'Bạn đang mong chờ điều gì?', 'Chiến thắng nhỏ của bạn tuần này là gì?', 'Hôm nay bạn nói chuyện với ai và học được gì từ họ?',
  'Điều gì đang khiến bạn lo lắng, và bước đầu tiên bạn có thể làm là gì?', 'Viết về một nơi mang lại cảm giác như ở nhà.', 'Hôm nay bạn ăn gì ngon?', 'Bạn sẽ nói gì với chính mình một năm trước?', 'Thói quen bạn muốn xây dựng là gì, và tại sao?',
  'Mô tả chi tiết buổi sáng của bạn.', 'Lời khuyên hay nhất bạn nhận được gần đây là gì?', 'Hôm nay bạn đã làm gì chỉ cho riêng mình?', 'Nếu được thay đổi một điều về hôm nay, đó là gì?', 'Viết một bức thư cho người bạn nhớ.',
  'Tháng này bạn tự hào về điều gì?', 'Mô tả thời tiết và ảnh hưởng của nó đến tâm trạng bạn.', 'Câu hỏi nào bạn cứ quay lại mãi?', 'Gần đây bạn đọc, xem hay nghe gì mà còn đọng lại?', 'Bạn đang né tránh điều gì?',
  'Ai đã truyền cảm hứng cho bạn tuần này?', 'Viết về một sai lầm đã dạy bạn điều gì đó.', 'Một cuối tuần hoàn hảo trông như thế nào?', 'Kỹ năng nào bạn đang tiến bộ?', 'Ký ức tuổi thơ nào gần đây hiện về?',
  'Mô tả một cuộc trò chuyện đã thay đổi suy nghĩ của bạn.', 'Hôm nay bạn để ý điều gì mà thường bỏ qua?', 'Dạo này bạn tò mò về điều gì?', 'Phần khó nhất của hôm nay là gì?', 'Bạn muốn có nhiều hơn điều gì trong cuộc sống?',
  'Mô tả một âm thanh, mùi hương hay xúc cảm của hôm nay.', 'Hôm nay khác hôm qua ở điểm nào?',
] };
