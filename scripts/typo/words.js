// The words the typographic object is built from. Everything here comes from the page's own INDEX content
// (index.html, 01–05) — headings, phrases and sentence fragments, verbatim — plus a few alternative spellings of the
// same words (あさいち / アサイチ for 朝市 …), used for rhythm. No invented event information.
//   mid:   headings and characteristic phrases (medium size)
//   small: sentence fragments from the body text (small size; they make the fine detail of the silhouette)
//   kana:  alternative spellings, used as rhythm between the others
export const SECTIONS = {
  asaichi: {
    anchor: '朝市', en: 'ASAICHI',
    mid: ['輪島朝市', '出張輪島朝市', '輪島塗', '干物', 'あなご焼き', '海藻', 'お箸・漆器', '名産乾物', '1000+', '本場の味と技', '並ぶもの'],
    small: ['平安時代から千年以上続くとされる輪島朝市。', '2024年元日の大地震と大規模火災によって、', '街の一角は更地となりました。',
      'それでも「ここがあるから乗り越えられる」と、', '全国各地でテントを張って始まったのが', '「出張輪島朝市」です。', '屋外特設テント'],
    kana: ['あさいち', 'アサイチ', 'わじま', 'ワジマ', 'わじまぬり', 'ひもの', 'かいそう'],
  },
  program: {
    anchor: '催し', en: 'PROGRAM',
    mid: ['特別講演会', '復興応援フリーペーパー', '本場の味と技', '現地の高校生が伝える能登のいま', '学生が見つめた能登のいま', '無料配架'],
    small: ['名産海産物、輪島塗の直売', '現地の方が販売にいらっしゃいます', '登壇：輪島高校3年 中村輝人さん', '実体験の証言・活動報告・参加者との質疑応答',
      '発行：能登を応援する一橋有志の会', '朝市ブース・講演会会場にて無料配架'],
    kana: ['もよおし', 'こうえん', 'フリーペーパー', 'いま'],
  },
  noto: {
    anchor: '能登', en: 'NOTO',
    mid: ['報道が減っても、', '現場の歩みは続く。', '朝市と能登', '前を向く人たちの底力', '忘れ去られることへの怖さ', '生活再建', 'インフラ復旧'],
    small: ['東京ではニュースで見かける回数が減っても、', '現地では解体やインフラ復旧、', '生活再建に向けた泥臭い日々が続いています。',
      '私たちが9月の取材で肌で感じたのは、', '「忘れ去られることへの怖さ」と', '「前を向く人たちの底力」でした。'],
    kana: ['のと', 'ノト', 'つながる'],
  },
  support: {
    anchor: '応援', en: 'SUPPORT',
    mid: ['クラウドファンディング', '支援金の使い道', '朝市の誘致・運営費', '高校生講演会の開催費', 'フリーペーパー印刷費', '企業・団体協賛',
      '¥10,000', '¥20,000', '¥50,000', '¥100,000', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'CAMPFIRE'],
    small: ['能登の声を東京へ届けるため、', 'クラウドファンディングに挑戦しています。', '輪島からの出店者の交通・宿泊費、機材・保冷輸送の実費',
      '9月現地取材の制作費と、来場者へ無料配布するための印刷代', '企業・団体協賛を募集しています。', '協賛趣意書・請求書払いのご相談は随時承っております。'],
    kana: ['おうえん', 'オウエン', 'とどける', 'こえ'],
  },
  info: {
    anchor: '案内', en: 'INFO',
    mid: ['2026.11.21–23', '一橋大学 国立西キャンパス', '入場無料', 'JR中央線 国立駅', '徒歩約10分', '一橋祭', '3日間', '国立'],
    small: ['一橋祭 会期中・3日間', '屋外広場・教室（東京都国立市中2-1）', 'JR中央線 国立駅 南口から徒歩約10分', '大学通りをまっすぐ',
      'どなたでも自由にご来場いただけます', '主催　能登を応援する一橋有志の会', '特別協力　輪島朝市を応援する会'],
    kana: ['あんない', 'ひとつばし', 'くにたち', 'やってくる', 'にぎわい'],
  },
};
