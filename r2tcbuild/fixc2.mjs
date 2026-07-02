import fs from 'fs';
const F='src/screens/HomeScreen.tsx';
let s=fs.readFileSync(F,'utf8');
if(s.indexOf('composeOpen')>-1) throw new Error('already patched');
{
  const sp=s.indexOf('const submitPost');
  if(sp<0) throw new Error('no submitPost');
  const ls=s.lastIndexOf('\n',sp)+1;
  const ind=(s.slice(ls).match(/^[ \t]*/)||[''])[0];
  s=s.slice(0,ls)+ind+'const [composeOpen, setComposeOpen] = useState(false);\n'+s.slice(ls);
}
{
  const ci=s.indexOf('ref={composerInputRef}');
  if(ci<0) throw new Error('no composerInputRef');
  const a=s.lastIndexOf('<TextInput',ci);
  const b=s.indexOf('/>',ci)+2;
  if(a<0||b<2) throw new Error('bounds');
  const ls=s.lastIndexOf('\n',a)+1;
  const ind=(s.slice(ls).match(/^[ \t]*/)||[''])[0];
  const r='<TouchableOpacity style={styles.feedInput} activeOpacity={0.7} onPress={() => setComposeOpen(true)}>\n'+ind+'  <Text numberOfLines={1} style={{ color: postText ? colors.text : colors.textMuted, fontSize: 14 }}>{postText ? postText : "Share something with the tour..."}</Text>\n'+ind+'</TouchableOpacity>';
  s=s.slice(0,a)+r+s.slice(b);
}
{
  const fp=s.indexOf('styles.feedPostText');
  if(fp<0) throw new Error('no feedPostText');
  const vc=s.indexOf('</View>',fp)+7;
  const ls=s.lastIndexOf('\n',vc-7)+1;
  const ind=(s.slice(ls).match(/^[ \t]*/)||[''])[0];
  const m='\n'+
  ind+'<Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>\n'+
  ind+'  <View style={{ flex: 1, backgroundColor: "#FFFFFF", paddingTop: 48 }}>\n'+
  ind+'    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#ECECEC" }}>\n'+
  ind+'      <TouchableOpacity onPress={() => setComposeOpen(false)}><Text style={{ color: "#6B7280", fontSize: 16 }}>Cancel</Text></TouchableOpacity>\n'+
  ind+'      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>\n'+
  ind+'        <TouchableOpacity onPress={pickMedia}><Text style={{ color: "#2563EB", fontSize: 15, fontWeight: "600" }}>Photo</Text></TouchableOpacity>\n'+
  ind+'        <TouchableOpacity disabled={posting || !postText.trim()} onPress={async () => { await submitPost(); setComposeOpen(false); }} style={{ backgroundColor: "#22C55E", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, opacity: (posting || !postText.trim()) ? 0.5 : 1 }}>\n'+
  ind+'          <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{posting ? "Posting" : "Post"}</Text>\n'+
  ind+'        </TouchableOpacity>\n'+
  ind+'      </View>\n'+
  ind+'    </View>\n'+
  ind+'    <TextInput style={{ flex: 1, color: "#111827", fontSize: 17, paddingHorizontal: 16, paddingTop: 14, textAlignVertical: "top" }} placeholder="Share something with the tour..." placeholderTextColor="#9CA3AF" value={postText} onChangeText={setPostText} multiline autoFocus />\n'+
  ind+'  </View>\n'+
  ind+'</Modal>';
  s=s.slice(0,vc)+m+s.slice(vc);
}
fs.writeFileSync(F,s);
console.log('PATCH OK');
