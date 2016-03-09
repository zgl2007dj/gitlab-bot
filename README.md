# gitlab-bot
使用gitlab 进行持续集成


Gitlab Community Edition 有一套比较完善的[自动构建系统](https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/ci/quick_start/README.md) 以及非常多的[hooks](https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md)([还有这个](https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/system_hooks/system_hooks.md)) 加上[trigger](https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/ci/triggers/README.md) 机制可以灵活的控制build任务

那么利用这些个接口我们可以弄一个简单的自动构建机器人来提高团队之间的开发效率

首先进入项目的Settting页面

![add web hooks](http://ww1.sinaimg.cn/large/74311666jw1f1q9twodw5j20j60h8acf.jpg)

这儿订阅 push 事件 comments事件 和 merge Request 事件。 如果有需要还可以开启https支持 然后填写一个url(这个就是自己实现的一个bot) 点击添加就好

然后进入个人的Setting 页面获取一个private token 后面会用这个token来发消息 （建议创建一个 bot的帐号用独立的token）

![private token](http://ww1.sinaimg.cn/large/74311666jw1f1q9z5b8z0j21kw0j40vl.jpg)

最后进入项目的 Settings > Triggers页面 单击 Add trigger 按钮创建一个新的trigger token
这个token可以通过api来触发你的build任务从而实现自动化

![trigger](http://ww4.sinaimg.cn/large/74311666jw1f1qa39zq28j20u1094754.jpg)

这几个条件满足之后就可以开始开发机器人了,这儿我就用nodejs 写一个最简单的实现

我们可能想在开发发起merge request 合并到主分支的时候 只要review者通过且单元测试顺利则自动去部署（这儿可以是内部的测试环境, 生产环境则不建议）

那我们设计的机器人就这样,监听merge request 只要有人发起则回复一个消息询问是否要自动部署。当下次merge后则判断之前是否有需要自动部署的评论 如果有则用trigger 触发depoly的构建 : )

大致的代码如下


```
app.use('/trigger-ci', function(req, res, next) {
    var object_kind = req.body.object_kind;
    var object_attributes = req.body.object_attributes;

    if (object_kind == 'note') {

        if (object_attributes.noteable_type == 'MergeRequest') {
            if (object_attributes.note == '大海') {
                console.log(object_attributes);
                MergeRequestNote(object_attributes.project_id,
                    req.body.merge_request.id,
                    '我们的征途是星辰大海');
            } else if (object_attributes.note.trim() == '看美女') {
                GetWomenPhoto(function(url) {
                    MergeRequestNote(object_attributes.project_id,
                        req.body.merge_request.id,
                        '![美女](' + url + ')');
                });
            } else if (object_attributes.note.trim() == '讲笑话') {
                GetJoke(function(joke) {
                    MergeRequestNote(object_attributes.project_id,
                        req.body.merge_request.id,
                        joke.title + '\r\n\r\n' + joke.text);
                });
            } else if (object_attributes.note.trim() == '合并后部署') {
                MergeRequestNote(object_attributes.project_id,
                    req.body.merge_request.id,
                    '好的! 当这个分支成功合并后 我会触发部署服务! \r\n ![fax_nick](http://ww1.sinaimg.cn/large/74311666jw1f1qaa18su7j20dw08zgmb.jpg)');
            }
        }
    } else if (object_kind == 'merge_request') {

        if (object_attributes.action == 'open' || object_attributes.action == 'reopen') {

            MergeRequestNote(object_attributes.target_project_id,
                object_attributes.id,
                '您好! 尼克狐为您服务! 合并请求通过后需要我做些什么吗? 例如: 合并后部署 讲笑话 看美女 ? \r\n ![DC_W_LVGKY6H7RYX8F__WWI](http://ww1.sinaimg.cn/large/74311666jw1f1qa9kmjmcj206h08cdg2.jpg)');
        } else if (object_attributes.action == 'merge') {
            //遍历commit
            GetMergeNotes(object_attributes.target_project_id,
                object_attributes.id, function(err, notes) {
                    for (index in notes) {
                        if (notes[index].body.trim() == '合并后部署') {
                            GetCiID(object_attributes.target_project_id, function(err, ci) {
                                InvokeTrigger(ci, object_attributes.target_branch, function(err, ciResult) {
                                    MergeRequestNote(object_attributes.target_project_id,
                                        object_attributes.id, '我已成功触发自动构建 [View build details](' + object_attributes.target.web_url + '/commit/' + JSON.parse(ciResult).commit.sha + '/builds)');
                                });
                            });
                            break;
                        }
                    }
                });
        }
    }
    res.send("ok");
});
```

上面的代码实现了监听了合并请求和评论的事件,然后会对一些命令做出响应(这儿特意加了看美女和讲笑话的实现可以自动去随机获取哟~ 编码道路上不在枯燥!!!)

PS: 我们的项目使用git的build做自动构建并且生成docker镜像push到仓库,然后会回掉k8s服务去做自动更新部署详情请看源码


上图看效果

![merge request](http://7xrn7f.com1.z0.glb.clouddn.com/16-3-9/2889275.jpg)

![merge depoly](http://ww4.sinaimg.cn/large/74311666jw1f1qajp0423j218e14646a.jpg)

![women](http://ww3.sinaimg.cn/large/74311666jw1f1qakbuwrrj2186134aep.jpg)

![merge](http://ww4.sinaimg.cn/large/74311666jw1f1qakrfbf2j218m08ojsk.jpg)

![build success](http://7xrn7f.com1.z0.glb.clouddn.com/16-3-9/41236685.jpg)


### 参考内容

[0] https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/ci/quick_start/README.md

[1] https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md

[2] https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/system_hooks/system_hooks.md

[3] https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/ci/triggers/README.md

[4] https://github.com/gitlabhq/gitlabhq/tree/master/doc/api
