# GitHub Git Data API 全量推送:本地 blob sha 与远端 tree 对比,仅上传差异 blob
# 用途:git 直连被断时的兜底(gh 走 api.github.com)
# 限制:GitHub Trees API 无法删除文件,被删文件会残留在远端(待 git 直连恢复后 git push 清理)
import base64, json, subprocess, sys, tempfile, os

REPO = 'smftec/Mineradio-pro'

def gh(endpoint, method='GET', body=None):
    cmd = ['gh', 'api', f'repos/{REPO}/{endpoint}']
    if method != 'GET':
        cmd += ['-X', method]
    if body is not None:
        fp = os.path.join(tempfile.gettempdir(), f'gh-body-{abs(hash(endpoint))}.json')
        with open(fp, 'w', encoding='utf-8') as f:
            json.dump(body, f, ensure_ascii=False)
        cmd += ['--input', fp]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise RuntimeError(f'gh api {endpoint}: {r.stderr[:300]}')
    return json.loads(r.stdout) if r.stdout.strip() else None

def git(*args):
    return subprocess.run(['git'] + list(args), capture_output=True, text=True, encoding='utf-8').stdout

# 本地 HEAD 信息
head_sha = git('rev-parse', 'HEAD').strip()
head_tree = git('rev-parse', 'HEAD^{tree}').strip()
msg = git('log', '-1', '--pretty=%B').strip()
print('local HEAD:', head_sha[:7], 'tree:', head_tree[:7])

# 远端 main
remote = gh('commits/main')
remote_sha = remote['sha']
remote_tree = remote['commit']['tree']['sha']
print('remote main:', remote_sha[:7], 'tree:', remote_tree[:7])

# 远端 tree 全文件映射
remote_tree_data = gh(f'git/trees/{remote_tree}?recursive=1')
remote_map = {t['path']: t['sha'] for t in remote_tree_data['tree'] if t['type'] == 'blob'}

# 本地全部文件 blob sha(git hash-object 与 GitHub blob sha 同算法)
files = [f for f in git('ls-files').splitlines() if f.strip()]
entries = []
uploaded = 0
for path in files:
    if not path.strip():
        continue
    sha = git('hash-object', path).strip()
    if remote_map.get(path) == sha:
        entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': sha})
        continue
    content = open(path, 'rb').read()
    blob = gh('git/blobs', 'POST', body={'content': base64.b64encode(content).decode(), 'encoding': 'base64'})
    entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    uploaded += 1
    print('upload:', path)
print('total files:', len(files), 'uploaded blobs:', uploaded)

tree = gh('git/trees', 'POST', body={'base_tree': remote_tree, 'tree': entries})
print('tree:', tree['sha'][:7])

commit = gh('git/commits', 'POST', body={'message': msg, 'tree': tree['sha'], 'parents': [remote_sha]})
print('commit:', commit['sha'][:7])

gh('git/refs/heads/main', 'PATCH', body={'sha': commit['sha'], 'force': False})
print('PUSHED via API:', commit['sha'][:7])
